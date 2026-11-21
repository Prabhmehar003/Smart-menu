// MenuPreviewEditor.jsx
// Intermediate preview and customization step before final QR code generation.
// Allows restaurant owners to inspect parsed dishes, tweak names/prices,
// and upload their own photos for any dish before committing to tables.

import React, { useState, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Camera, Trash2, Plus, Check, AlertTriangle,
  ArrowLeft, RefreshCw, Search, X, Sparkles,
  ChevronUp, ChevronDown, Store, Table2, ImagePlus, CheckCircle2,
  DollarSign
} from 'lucide-react';
import { api, API_ROOT } from '../api';

export default function MenuPreviewEditor({
  initialData,
  numTables,
  setNumTables,
  onConfirm,
  onCancel,
  isFinalizing,
}) {
  const [menuData, setMenuData] = useState(() => {
    // Deep clone to allow safe local mutations
    try {
      return JSON.parse(JSON.stringify(initialData?.menu_data || { categories: [] }));
    } catch {
      return { categories: [] };
    }
  });

  const [restaurantName, setRestaurantName] = useState(
    initialData?.restaurant_name || initialData?.menu_data?.restaurant_name || 'My Restaurant'
  );

  const [activeCategory, setActiveCategory] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [uploadingDishKey, setUploadingDishKey] = useState(null);
  const [customPhotos, setCustomPhotos] = useState(() => new Set());
  const [errorMsg, setErrorMsg] = useState(null);

  // Quick stats
  const totalDishes = useMemo(() => {
    return (menuData.categories || []).reduce(
      (acc, cat) => acc + (cat.items?.length || 0),
      0
    );
  }, [menuData]);

  const categories = menuData.categories || [];

  // Filtered categories & dishes
  const filteredCategories = useMemo(() => {
    return categories
      .map((cat, catIdx) => {
        if (activeCategory !== 'ALL' && cat.category_name !== activeCategory) {
          return null;
        }
        const filteredItems = (cat.items || []).filter((item) => {
          if (!searchQuery.trim()) return true;
          return item.name?.toLowerCase().includes(searchQuery.toLowerCase());
        });

        if (activeCategory !== 'ALL' || filteredItems.length > 0) {
          return { ...cat, originalCatIndex: catIdx, items: filteredItems };
        }
        return null;
      })
      .filter(Boolean);
  }, [categories, activeCategory, searchQuery]);

  // Handle dish custom photo upload
  const handleUploadDishPhoto = async (catIdx, itemIdx, file) => {
    if (!file) return;

    const cat = categories[catIdx];
    const item = cat?.items?.[itemIdx];
    if (!item) return;

    const dishKey = `${catIdx}_${itemIdx}_${item.name}`;
    setUploadingDishKey(dishKey);
    setErrorMsg(null);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('dish_name', item.name || 'Dish');
    formData.append('category', cat.category_name || '');

    try {
      const res = await api.uploadCustomDishImage(formData);
      if (res?.image_url) {
        setMenuData((prev) => {
          const next = JSON.parse(JSON.stringify(prev));
          if (next.categories[catIdx]?.items[itemIdx]) {
            next.categories[catIdx].items[itemIdx].image_url = res.image_url;
          }
          return next;
        });
        setCustomPhotos((prev) => new Set(prev).add(dishKey));
      }
    } catch (err) {
      setErrorMsg(`Photo upload failed: ${err.message || 'Server error'}`);
    } finally {
      setUploadingDishKey(null);
    }
  };

  // Inline dish field edit
  const handleUpdateItem = (catIdx, itemIdx, field, value) => {
    setMenuData((prev) => {
      const next = JSON.parse(JSON.stringify(prev));
      if (next.categories[catIdx]?.items[itemIdx]) {
        next.categories[catIdx].items[itemIdx][field] = value;
      }
      return next;
    });
  };

  // Delete dish
  const handleDeleteItem = (catIdx, itemIdx) => {
    setMenuData((prev) => {
      const next = JSON.parse(JSON.stringify(prev));
      if (next.categories[catIdx]?.items) {
        next.categories[catIdx].items.splice(itemIdx, 1);
      }
      return next;
    });
  };

  // Remove photo from dish (leaves dish in menu with no image)
  const handleRemovePhoto = (catIdx, itemIdx) => {
    setMenuData((prev) => {
      const next = JSON.parse(JSON.stringify(prev));
      if (next.categories[catIdx]?.items[itemIdx]) {
        next.categories[catIdx].items[itemIdx].image_url = '';
      }
      return next;
    });
    const item = categories[catIdx]?.items[itemIdx];
    if (item) {
      const dishKey = `${catIdx}_${itemIdx}_${item.name}`;
      setCustomPhotos((prev) => {
        const next = new Set(prev);
        next.delete(dishKey);
        return next;
      });
    }
  };

  // Reset custom photo back to AI studio image
  const handleResetToDefaultPhoto = (catIdx, itemIdx) => {
    const cat = categories[catIdx];
    const item = cat?.items?.[itemIdx];
    if (!item) return;
    const defaultUrl = `/api/dishes/image?name=${encodeURIComponent(item.name || '')}&category=${encodeURIComponent(cat.category_name || '')}&v=${Date.now()}`;
    setMenuData((prev) => {
      const next = JSON.parse(JSON.stringify(prev));
      if (next.categories[catIdx]?.items[itemIdx]) {
        next.categories[catIdx].items[itemIdx].image_url = defaultUrl;
      }
      return next;
    });
    const dishKey = `${catIdx}_${itemIdx}_${item.name}`;
    setCustomPhotos((prev) => {
      const next = new Set(prev);
      next.delete(dishKey);
      return next;
    });
  };

  // Add new dish
  const handleAddItem = (catIdx) => {
    const cat = categories[catIdx];
    const newItemName = prompt('Enter new dish name:');
    if (!newItemName || !newItemName.trim()) return;

    const priceInput = prompt('Enter price (numeric):', '150');
    const priceNum = parseFloat(priceInput) || 0;

    setMenuData((prev) => {
      const next = JSON.parse(JSON.stringify(prev));
      if (next.categories[catIdx]) {
        if (!next.categories[catIdx].items) next.categories[catIdx].items = [];
        next.categories[catIdx].items.push({
          name: newItemName.trim(),
          price: priceNum,
          description: '',
          tags: ['new'],
          image_url: `/api/dishes/image?name=${encodeURIComponent(newItemName.trim())}&category=${encodeURIComponent(cat.category_name || '')}&v=${Date.now()}`,
        });
      }
      return next;
    });
  };

  const handleFinalConfirm = () => {
    const customizedMenuData = {
      ...menuData,
      restaurant_name: restaurantName,
    };
    onConfirm({
      menu_data: customizedMenuData,
      restaurant_name: restaurantName,
      num_tables: numTables,
    });
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Top Banner / Progress Step */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 sm:p-6 rounded-2xl sm:rounded-3xl border border-amber-400/30 bg-gradient-to-br from-amber-500/10 via-[#0a0d14]/80 to-[#08090e]/90 backdrop-blur-2xl shadow-[0_12px_32px_rgba(0,0,0,0.6)]">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-amber-400/40 bg-amber-400/10 text-amber-300 font-mono text-xs font-bold tracking-wider uppercase mb-2">
            <Sparkles size={13} className="text-amber-400" />
            <span>Step 2 of 2 · Preview &amp; Customize</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white flex items-center gap-2.5">
            Review Your Digital Menu
          </h2>
          <p className="font-mono text-xs text-zinc-400 mt-1 max-w-2xl">
            Inspect all parsed dishes and prices. Click <strong>&ldquo;Change Photo&rdquo;</strong> on any dish to upload your own real food image before generating final Table QR codes.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0 flex-wrap">
          <button
            type="button"
            onClick={onCancel}
            disabled={isFinalizing}
            className="h-11 px-4 rounded-xl border border-white/15 bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white font-mono text-xs font-bold inline-flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
          >
            <ArrowLeft size={14} className="text-zinc-400" />
            <span>Discard &amp; Re-upload</span>
          </button>

          <button
            type="button"
            onClick={handleFinalConfirm}
            disabled={isFinalizing || totalDishes === 0}
            className="h-11 px-6 rounded-xl font-mono text-xs font-black tracking-wider uppercase bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 hover:from-amber-400 hover:to-amber-300 text-black shadow-[0_0_25px_rgba(245,158,11,0.35)] transition-all cursor-pointer active:scale-95 inline-flex items-center gap-2 disabled:opacity-50"
          >
            {isFinalizing ? (
              <>
                <RefreshCw size={15} className="animate-spin text-black" />
                <span>Generating QR Codes…</span>
              </>
            ) : (
              <>
                <CheckCircle2 size={16} className="text-black" />
                <span>Confirm &amp; Generate QR ({numTables} Tables)</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Global Config Bar: Restaurant Name + Table Count */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Restaurant Name */}
        <div className="p-4 rounded-2xl border border-white/10 bg-[#0a0d14]/70 backdrop-blur-xl">
          <label className="block font-mono text-[11px] font-bold uppercase tracking-wider text-amber-400 mb-1.5 flex items-center gap-1.5">
            <Store size={13} />
            <span>Restaurant Name</span>
          </label>
          <input
            type="text"
            value={restaurantName}
            onChange={(e) => setRestaurantName(e.target.value)}
            placeholder="Restaurant Name"
            className="w-full bg-white/5 border border-white/10 focus:border-amber-400/60 rounded-xl px-3 py-2 text-sm text-white font-medium outline-none transition-all"
          />
        </div>

        {/* Total Tables Stepper */}
        <div className="p-4 rounded-2xl border border-white/10 bg-[#0a0d14]/70 backdrop-blur-xl">
          <label className="block font-mono text-[11px] font-bold uppercase tracking-wider text-amber-400 mb-1.5 flex items-center gap-1.5">
            <Table2 size={13} />
            <span>Total Tables / Rooms</span>
          </label>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setNumTables((prev) => Math.max(1, (Number(prev) || 1) - 1))}
              className="w-9 h-9 rounded-xl border border-white/15 bg-white/5 hover:bg-white/10 text-white flex items-center justify-center cursor-pointer transition-all"
            >
              <ChevronDown size={16} />
            </button>
            <input
              type="number"
              min={1}
              max={100}
              value={numTables}
              onChange={(e) => setNumTables(Math.min(100, Math.max(1, parseInt(e.target.value) || 1)))}
              className="w-20 text-center bg-white/5 border border-white/10 focus:border-amber-400/60 rounded-xl py-1.5 text-sm font-mono font-bold text-white outline-none"
            />
            <button
              type="button"
              onClick={() => setNumTables((prev) => Math.min(100, (Number(prev) || 1) + 1))}
              className="w-9 h-9 rounded-xl border border-white/15 bg-white/5 hover:bg-white/10 text-white flex items-center justify-center cursor-pointer transition-all"
            >
              <ChevronUp size={16} />
            </button>
            <span className="font-mono text-xs text-zinc-400 ml-1">QR stands</span>
          </div>
        </div>

        {/* Total Summary */}
        <div className="p-4 rounded-2xl border border-white/10 bg-[#0a0d14]/70 backdrop-blur-xl flex flex-col justify-center">
          <span className="font-mono text-[11px] font-bold uppercase tracking-wider text-zinc-400">
            Detected Content
          </span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-black text-amber-400">{totalDishes}</span>
            <span className="font-mono text-xs text-zinc-400">
              dishes across {categories.length} categories
            </span>
          </div>
        </div>
      </div>

      {/* Error alert if any */}
      {errorMsg && (
        <div className="flex items-center gap-3 p-4 rounded-2xl border border-rose-500/40 bg-rose-500/10 text-rose-300 font-mono text-xs">
          <AlertTriangle size={16} className="shrink-0 text-rose-400" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Search & Category Filter Navigation */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {/* Search box */}
          <div className="relative flex-1 max-w-md">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter dishes by name…"
              className="w-full bg-[#0a0d14]/80 border border-white/15 focus:border-amber-400/60 rounded-xl pl-9 pr-9 py-2.5 font-mono text-xs text-white placeholder:text-zinc-500 outline-none transition-all shadow-inner"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white"
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        {/* Category Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-white/10">
          <button
            type="button"
            onClick={() => setActiveCategory('ALL')}
            className={`px-3.5 py-1.5 rounded-full font-mono text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
              activeCategory === 'ALL'
                ? 'bg-amber-400 text-black shadow-[0_0_15px_rgba(245,158,11,0.4)]'
                : 'bg-white/5 border border-white/10 text-zinc-400 hover:text-white hover:border-white/25'
            }`}
          >
            All Categories ({totalDishes})
          </button>
          {categories.map((cat, idx) => {
            const count = cat.items?.length || 0;
            const isSelected = activeCategory === cat.category_name;
            return (
              <button
                key={idx}
                type="button"
                onClick={() => setActiveCategory(cat.category_name)}
                className={`px-3.5 py-1.5 rounded-full font-mono text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                  isSelected
                    ? 'bg-amber-400 text-black shadow-[0_0_15px_rgba(245,158,11,0.4)]'
                    : 'bg-white/5 border border-white/10 text-zinc-400 hover:text-white hover:border-white/25'
                }`}
              >
                {cat.category_name} ({count})
              </button>
            );
          })}
        </div>
      </div>

      {/* Categories & Dish Cards Grid */}
      <div className="space-y-10">
        {filteredCategories.map((cat) => {
          const catIdx = cat.originalCatIndex;
          return (
            <div key={catIdx} className="space-y-4">
              {/* Category Header */}
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <div className="flex items-center gap-3">
                  <div className="w-2.5 h-2.5 rounded-full bg-amber-400 shadow-[0_0_8px_rgba(245,158,11,0.8)]" />
                  <h3 className="text-lg font-bold text-white tracking-wide">
                    {cat.category_name}
                  </h3>
                  <span className="font-mono text-xs px-2.5 py-0.5 rounded-full bg-white/5 border border-white/10 text-zinc-400">
                    {cat.items?.length || 0} items
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => handleAddItem(catIdx)}
                  className="font-mono text-xs font-semibold px-3 py-1.5 rounded-lg border border-amber-400/30 bg-amber-400/10 text-amber-300 hover:bg-amber-400/20 transition-all inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus size={13} />
                  <span>Add Dish</span>
                </button>
              </div>

              {/* Items Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
                {cat.items?.map((item, itemIdx) => {
                  const dishKey = `${catIdx}_${itemIdx}_${item.name}`;
                  const isUploadingThis = uploadingDishKey === dishKey;
                  const hasCustomPhoto = customPhotos.has(dishKey);

                  return (
                    <DishCard
                      key={itemIdx}
                      item={item}
                      catName={cat.category_name}
                      isUploading={isUploadingThis}
                      hasCustomPhoto={hasCustomPhoto}
                      onUploadPhoto={(file) => handleUploadDishPhoto(catIdx, itemIdx, file)}
                      onRemovePhoto={() => handleRemovePhoto(catIdx, itemIdx)}
                      onResetPhoto={() => handleResetToDefaultPhoto(catIdx, itemIdx)}
                      onUpdateName={(val) => handleUpdateItem(catIdx, itemIdx, 'name', val)}
                      onUpdatePrice={(val) => handleUpdateItem(catIdx, itemIdx, 'price', val)}
                      onDelete={() => handleDeleteItem(catIdx, itemIdx)}
                    />
                  );
                })}
              </div>
            </div>
          );
        })}

        {filteredCategories.length === 0 && (
          <div className="py-16 text-center rounded-2xl border border-white/10 bg-white/[0.02]">
            <p className="font-mono text-sm text-zinc-400">No dishes match your filter.</p>
            <button
              type="button"
              onClick={() => { setActiveCategory('ALL'); setSearchQuery(''); }}
              className="mt-3 font-mono text-xs text-amber-400 hover:underline"
            >
              Reset filters
            </button>
          </div>
        )}
      </div>

      {/* Floating Bottom Sticky Action Dock */}
      <div className="sticky bottom-4 z-40 p-4 rounded-2xl border border-white/15 bg-[#0a0d14]/90 backdrop-blur-2xl shadow-[0_20px_50px_rgba(0,0,0,0.9)] flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-400/10 border border-amber-400/30 flex items-center justify-center text-amber-400">
            <Check size={18} />
          </div>
          <div>
            <p className="font-mono text-xs font-bold text-white">
              Ready to generate table QR stands?
            </p>
            <p className="font-mono text-[11px] text-zinc-400">
              {totalDishes} items reviewed · {numTables} table QR stands will be prepared
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
          <button
            type="button"
            onClick={onCancel}
            disabled={isFinalizing}
            className="h-10 px-4 rounded-xl border border-white/15 bg-white/5 hover:bg-white/10 text-zinc-300 font-mono text-xs font-bold transition-all cursor-pointer"
          >
            Discard
          </button>
          <button
            type="button"
            onClick={handleFinalConfirm}
            disabled={isFinalizing || totalDishes === 0}
            className="h-10 px-6 rounded-xl font-mono text-xs font-black tracking-wider uppercase bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 hover:from-amber-400 hover:to-amber-300 text-black shadow-[0_0_20px_rgba(245,158,11,0.4)] transition-all cursor-pointer active:scale-95 inline-flex items-center gap-2"
          >
            {isFinalizing ? (
              <>
                <RefreshCw size={14} className="animate-spin text-black" />
                <span>Processing…</span>
              </>
            ) : (
              <>
                <CheckCircle2 size={15} className="text-black" />
                <span>Confirm &amp; Generate QR</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// Individual Dish Card with Photo Upload & Editing
function DishCard({
  item,
  catName,
  isUploading,
  hasCustomPhoto,
  onUploadPhoto,
  onRemovePhoto,
  onResetPhoto,
  onUpdateName,
  onUpdatePrice,
  onDelete,
}) {
  const fileInputRef = useRef(null);
  const [imgError, setImgError] = useState(false);

  // If item.image_url is explicitly empty string, it means the user removed the image.
  const hasImage = item.image_url !== '' && item.image_url !== null;
  const rawUrl = hasImage
    ? (item.image_url || `/api/dishes/image?name=${encodeURIComponent(item.name || '')}&category=${encodeURIComponent(catName || '')}&v=3`)
    : null;
  const imageUrl = rawUrl
    ? (rawUrl.startsWith('http') || rawUrl.startsWith('blob:') ? rawUrl : `${API_ROOT}${rawUrl}`)
    : null;

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setImgError(false);
      onUploadPhoto(file);
    }
  };

  return (
    <div className="group relative rounded-2xl border border-white/10 hover:border-amber-400/50 bg-[#0a0d14]/80 backdrop-blur-xl overflow-hidden transition-all duration-300 flex flex-col justify-between shadow-lg hover:shadow-[0_8px_25px_rgba(0,0,0,0.6)]">
      {/* Dish Image Container or Empty Photo Placeholder */}
      <div className="relative aspect-[4/3] w-full bg-black/40 overflow-hidden flex flex-col items-center justify-center">
        {imageUrl && !imgError ? (
          <>
            <img
              src={imageUrl}
              alt={item.name}
              loading="lazy"
              decoding="async"
              onError={() => setImgError(true)}
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            />

            {/* Top Badges & Actions */}
            <div className="absolute top-2.5 inset-x-2.5 flex items-center justify-between pointer-events-none z-10">
              {hasCustomPhoto ? (
                <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/90 text-black font-mono text-[10px] font-black shadow-md pointer-events-auto">
                  <Check size={11} strokeWidth={3} />
                  <span>Custom Photo</span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onResetPhoto();
                    }}
                    title="Reset to default photo"
                    className="hover:text-rose-900 transition-colors cursor-pointer ml-0.5"
                  >
                    <X size={11} />
                  </button>
                </div>
              ) : (
                <div />
              )}

              <div className="flex items-center gap-1 pointer-events-auto">
                {/* Remove photo from dish button */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemovePhoto();
                  }}
                  title="Remove image from dish"
                  className="w-7 h-7 rounded-full bg-black/60 hover:bg-amber-400 text-zinc-400 hover:text-black backdrop-blur-md border border-white/10 flex items-center justify-center transition-all cursor-pointer"
                >
                  <X size={13} />
                </button>

                {/* Delete dish button */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete();
                  }}
                  title="Delete dish from menu"
                  className="w-7 h-7 rounded-full bg-black/60 hover:bg-rose-500/80 text-zinc-400 hover:text-white backdrop-blur-md border border-white/10 flex items-center justify-center transition-all cursor-pointer"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>

            {/* Change Photo Overlay Button */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex flex-col items-center justify-end p-3 pointer-events-auto gap-1.5">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="w-full py-2 px-3 rounded-xl bg-amber-400 hover:bg-amber-300 text-black font-mono text-[11px] font-bold flex items-center justify-center gap-1.5 shadow-[0_4px_12px_rgba(0,0,0,0.5)] cursor-pointer active:scale-95 transition-all"
              >
                <Camera size={13} />
                <span>{hasCustomPhoto ? 'Replace Photo' : 'Upload Your Photo'}</span>
              </button>

              <button
                type="button"
                onClick={onRemovePhoto}
                className="w-full py-1.5 px-3 rounded-lg bg-white/10 hover:bg-rose-500/20 text-zinc-300 hover:text-rose-300 border border-white/10 hover:border-rose-500/40 font-mono text-[10px] font-medium transition-all cursor-pointer"
              >
                Remove Photo
              </button>
            </div>
          </>
        ) : (
          /* Empty Photo Placeholder */
          <div
            onClick={() => fileInputRef.current?.click()}
            className="w-full h-full border-2 border-dashed border-white/10 hover:border-amber-400/50 flex flex-col items-center justify-center gap-2 p-4 text-center cursor-pointer hover:bg-white/[0.02] transition-all relative"
            title="Click to add photo"
          >
            <div className="absolute top-2.5 right-2.5 pointer-events-auto">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete();
                }}
                title="Delete this dish"
                className="w-7 h-7 rounded-full bg-black/60 hover:bg-rose-500/80 text-zinc-400 hover:text-white backdrop-blur-md border border-white/10 flex items-center justify-center transition-all cursor-pointer"
              >
                <Trash2 size={13} />
              </button>
            </div>

            <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-zinc-400 group-hover:text-amber-400 group-hover:border-amber-400/30 transition-colors">
              <Camera size={18} />
            </div>
            <span className="font-mono text-xs text-zinc-400 group-hover:text-amber-300 transition-colors">
              No photo · Click to add
            </span>
          </div>
        )}

        {/* Uploading Overlay */}
        {isUploading && (
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center gap-2 z-20">
            <RefreshCw size={22} className="animate-spin text-amber-400" />
            <span className="font-mono text-[11px] font-bold text-white">
              Optimizing photo…
            </span>
          </div>
        )}

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          className="hidden"
        />
      </div>

      {/* Dish Details */}
      <div className="p-3.5 space-y-2 flex-1 flex flex-col justify-between">
        {/* Name input */}
        <div>
          <input
            type="text"
            value={item.name || ''}
            onChange={(e) => onUpdateName(e.target.value)}
            placeholder="Dish name"
            className="w-full bg-transparent font-bold text-sm text-white focus:bg-white/5 focus:border focus:border-amber-400/50 rounded-lg px-1.5 py-1 -mx-1.5 outline-none transition-all"
            title="Click to edit dish name"
          />
        </div>

        {/* Price & Tag */}
        <div className="flex items-center justify-between gap-2 pt-1 border-t border-white/5">
          <div className="flex items-center gap-1 bg-white/5 px-2.5 py-1 rounded-lg border border-white/10 focus-within:border-amber-400/50">
            <span className="font-mono text-xs text-amber-400 font-bold">₹</span>
            <input
              type="number"
              step="any"
              value={item.price ?? 0}
              onChange={(e) => onUpdatePrice(parseFloat(e.target.value) || 0)}
              className="w-16 bg-transparent font-mono text-xs font-bold text-white outline-none"
              title="Click to edit price"
            />
          </div>

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="text-[11px] font-mono text-zinc-400 hover:text-amber-300 inline-flex items-center gap-1 cursor-pointer transition-colors"
            title={imageUrl ? "Change photo" : "Add photo"}
          >
            <Camera size={12} />
            <span>{imageUrl ? "Change" : "Add Photo"}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
