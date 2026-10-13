import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldAlert, MapPin, Wifi, CheckCircle2, RefreshCw, WifiOff } from 'lucide-react';

// Step definitions drive both the progress rail and the status copy.
const STEPS = [
  { key: 'locate', label: 'LOCATING DEVICE' },
  { key: 'geofence', label: 'CHECKING GEOFENCE' },
  { key: 'session', label: 'OPENING SESSION' },
];

function StepRail({ activeIndex, failedIndex }) {
  return (
    <div className="flex items-center gap-2 mb-8">
      {STEPS.map((step, idx) => {
        const isDone = failedIndex === null && idx < activeIndex;
        const isActive = idx === activeIndex;
        const isFailed = failedIndex === idx;
        return (
          <React.Fragment key={step.key}>
            <div className="flex flex-col items-center gap-2">
              <div
                className={`w-8 h-8 rounded-full border flex items-center justify-center transition-colors duration-300 ${
                  isFailed
                    ? 'border-[#FF00FF] bg-[#FF00FF]/10'
                    : isDone
                      ? 'border-[#D6FF00] bg-[#D6FF00]/10'
                      : isActive
                        ? 'border-[#00F0FF] bg-[#00F0FF]/10'
                        : 'border-white/15 bg-white/5'
                }`}
              >
                {isFailed ? (
                  <ShieldAlert size={14} className="text-[#FF00FF]" />
                ) : isDone ? (
                  <CheckCircle2 size={14} className="text-[#D6FF00]" />
                ) : isActive ? (
                  <span className="w-2 h-2 rounded-full bg-[#00F0FF] animate-pulse" />
                ) : (
                  <span className="w-1.5 h-1.5 rounded-full bg-white/20" />
                )}
              </div>
              <span
                className={`font-mono text-[9px] tracking-wide text-center leading-tight max-w-[64px] ${
                  isFailed ? 'text-[#FF00FF]' : isActive || isDone ? 'text-white/70' : 'text-white/30'
                }`}
              >
                {step.label}
              </span>
            </div>
            {idx < STEPS.length - 1 && (
              <div
                className={`h-px flex-1 mb-5 transition-colors duration-300 ${
                  idx < activeIndex && failedIndex === null ? 'bg-[#D6FF00]/50' : 'bg-white/10'
                }`}
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

function ScanVerifier({ token, code, setSession }) {
  const navigate = useNavigate();
  const [stepIndex, setStepIndex] = useState(0);
  const [failedIndex, setFailedIndex] = useState(null);
  const [error, setError] = useState(null);
  const [errorKind, setErrorKind] = useState(null); // 'network' | 'verification' | 'geolocation'
  const [attempt, setAttempt] = useState(0);
  const [locationSkipped, setLocationSkipped] = useState(false);

  const run = useCallback(() => {
    setError(null);
    setErrorKind(null);
    setFailedIndex(null);
    setStepIndex(0);
    setLocationSkipped(false);

    const searchParams = new URLSearchParams(window.location.search);
    const scanSource = (searchParams.get('src') || 'qr').toLowerCase();

    const verify = async (lat, lon) => {
      setStepIndex(1);
      if (lat == null || lon == null) setLocationSkipped(true);

      let res;
      try {
        const isProxy = Boolean(code) || (token && token.length <= 16);
        const endpoint = isProxy ? '/api/t/resolve' : '/api/verify-scan';
        const body = isProxy
          ? { code: code || token, src: scanSource }
          : { token, src: scanSource };

        if (lat != null && lon != null) {
          body.lat = lat;
          body.lon = lon;
        }
        res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
      } catch (networkErr) {
        setErrorKind('network');
        setFailedIndex(1);
        setError('Could not reach the restaurant server. Check your connection and try again.');
        return;
      }

      let data = {};
      try {
        data = await res.json();
      } catch {
        // non-JSON error body, fall through to status-based message
      }

      if (!res.ok) {
        setErrorKind('verification');
        setFailedIndex(1);
        setError(data.detail || 'This table link could not be verified. It may have expired.');
        return;
      }

      setStepIndex(2);

      try {
        localStorage.setItem('acid_session', JSON.stringify(data));
      } catch {
        // storage may be unavailable (private browsing) — session still works for this load
      }
      setSession(data);
      navigate('/menu', { replace: true });
    };

    setStepIndex(0);
    if (!navigator.geolocation) {
      verify(null, null);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => verify(pos.coords.latitude, pos.coords.longitude),
      (geoErr) => {
        // Permission denied or unavailable — proceed without location rather than blocking.
        verify(null, null);
      },
      { timeout: 2000, maximumAge: 300000 }
    );
  }, [token, code, setSession, navigate]);

  useEffect(() => {
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt]);

  const handleRetry = () => setAttempt((a) => a + 1);

  return (
    <div className="min-h-screen bg-[#030303] bg-noise flex flex-col items-center justify-center text-center p-6 text-white font-mono">
      <div className="clay-card border border-white/10 p-8 rounded-3xl bg-[#0a0a0a] max-w-sm w-full">
        <AnimatePresence mode="wait">
          {error ? (
            <motion.div
              key="error"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
            >
              <div className="w-14 h-14 rounded-2xl bg-[#FF00FF]/10 border border-[#FF00FF]/40 flex items-center justify-center mx-auto mb-5">
                {errorKind === 'network' ? (
                  <WifiOff className="w-7 h-7 text-[#FF00FF]" />
                ) : (
                  <ShieldAlert className="w-7 h-7 text-[#FF00FF]" />
                )}
              </div>
              <h2 className="text-[#FF00FF] font-bold text-lg mb-2 tracking-tight">
                {errorKind === 'network' ? 'CONNECTION LOST' : 'VERIFICATION FAILED'}
              </h2>
              <p className="text-white/50 text-xs leading-relaxed mb-6">{error}</p>
              <button
                onClick={handleRetry}
                className="clay-btn w-full bg-white/10 border border-white/20 hover:border-[#D6FF00] hover:bg-[#D6FF00]/10 text-white font-bold text-xs px-6 py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
              >
                <RefreshCw size={14} /> TRY AGAIN
              </button>
              <p className="text-white/25 text-[10px] mt-4 leading-relaxed">
                Still stuck? Ask a staff member to rescan or reprint your table QR.
              </p>
            </motion.div>
          ) : (
            <motion.div key="progress" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div className="flex items-center justify-center gap-2 mb-6 text-[#00F0FF]">
                {stepIndex === 0 && <MapPin className="w-6 h-6" />}
                {stepIndex === 1 && <Wifi className="w-6 h-6 animate-pulse" />}
                {stepIndex === 2 && <CheckCircle2 className="w-6 h-6 text-[#D6FF00]" />}
              </div>

              <StepRail activeIndex={stepIndex} failedIndex={failedIndex} />

              <p className="text-white/60 text-[11px] tracking-widest">
                {STEPS[stepIndex]?.label}...
              </p>
              {locationSkipped && stepIndex >= 1 && (
                <p className="text-white/25 text-[10px] mt-3">
                  Continuing without location access.
                </p>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

export default ScanVerifier;