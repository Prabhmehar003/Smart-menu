import sys
import os

class SimplePDFBuilder:
    def __init__(self, filename):
        self.filename = filename
        self.pages = []
        self.current_stream = []
        self.width = 595.28  # A4 width in points
        self.height = 841.89 # A4 height in points
        self.margin_left = 45
        self.margin_right = 45
        self.margin_top = 54
        self.margin_bottom = 54
        self.usable_width = self.width - self.margin_left - self.margin_right
        self.usable_height = self.height - self.margin_top - self.margin_bottom
        self.y = self.height - self.margin_top
        self.page_number = 0
        self.new_page()

    def new_page(self):
        if self.current_stream:
            self.pages.append(self.current_stream)
            self.current_stream = []
        self.page_number += 1
        self.y = self.height - self.margin_top
        
        # Add page header & footer decoration
        if self.page_number > 1:
            # Header line and running title
            self.draw_rect(self.margin_left, self.height - 35, self.usable_width, 1, fill_color=(200/255, 200/255, 200/255))
            self.add_text("Smart Menu Architecture | Service Window QR & Table Pairing", self.margin_left, self.height - 30, font_size=8, font_name="F1", color=(0.4, 0.4, 0.4))
        
        # Footer line and page number
        self.draw_rect(self.margin_left, 45, self.usable_width, 1, fill_color=(220/255, 220/255, 220/255))
        self.add_text(f"Page {self.page_number}", self.width - self.margin_right - 30, 32, font_size=8, font_name="F1", color=(0.5, 0.5, 0.5))
        self.add_text("CONFIDENTIAL & PROPRIETARY — SMART MENU SYSTEM", self.margin_left, 32, font_size=8, font_name="F1", color=(0.5, 0.5, 0.5))

    def ensure_space(self, height_needed):
        if self.y - height_needed < self.margin_bottom:
            self.new_page()

    def draw_rect(self, x, y, w, h, fill_color=None, stroke_color=None, stroke_width=1):
        op = []
        op.append("q")
        if fill_color:
            op.append(f"{fill_color[0]:.3f} {fill_color[1]:.3f} {fill_color[2]:.3f} rg")
        if stroke_color:
            op.append(f"{stroke_color[0]:.3f} {stroke_color[1]:.3f} {stroke_color[2]:.3f} RG")
            op.append(f"{stroke_width:.2f} w")
        op.append(f"{x:.2f} {y:.2f} {w:.2f} {h:.2f} re")
        if fill_color and stroke_color:
            op.append("B")
        elif fill_color:
            op.append("f")
        elif stroke_color:
            op.append("S")
        op.append("Q")
        self.current_stream.append(" ".join(op))

    def escape_text(self, text):
        return text.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")

    def add_text(self, text, x, y, font_size=10, font_name="F1", color=(0, 0, 0)):
        escaped = self.escape_text(text)
        op = f"q BT /{font_name} {font_size} Tf {color[0]:.3f} {color[1]:.3f} {color[2]:.3f} rg {x:.2f} {y:.2f} Td ({escaped}) Tj ET Q"
        self.current_stream.append(op)

    def add_wrapped_text(self, text, font_size=10, font_name="F1", color=(0.1, 0.1, 0.1), line_height=14, indent=0):
        # Rough width estimation for Helvetica: ~0.50 * font_size per char
        char_width = font_size * 0.50
        max_chars = int((self.usable_width - indent) / char_width)
        
        words = text.split(" ")
        lines = []
        current_line = []
        current_length = 0

        for word in words:
            if current_length + len(word) + (1 if current_line else 0) <= max_chars:
                current_line.append(word)
                current_length += len(word) + (1 if len(current_line) > 1 else 0)
            else:
                if current_line:
                    lines.append(" ".join(current_line))
                current_line = [word]
                current_length = len(word)

        if current_line:
            lines.append(" ".join(current_line))

        self.ensure_space(len(lines) * line_height)
        for line in lines:
            self.add_text(line, self.margin_left + indent, self.y, font_size=font_size, font_name=font_name, color=color)
            self.y -= line_height

    def add_heading_1(self, text):
        self.ensure_space(36)
        self.y -= 8
        self.draw_rect(self.margin_left, self.y - 4, 4, 20, fill_color=(0/255, 122/255, 255/255))
        self.add_text(text, self.margin_left + 12, self.y, font_size=16, font_name="F2", color=(15/255, 23/255, 42/255))
        self.y -= 24

    def add_heading_2(self, text):
        self.ensure_space(28)
        self.y -= 6
        self.add_text(text, self.margin_left, self.y, font_size=12, font_name="F2", color=(30/255, 41/255, 59/255))
        self.y -= 18

    def add_bullet(self, title, text):
        self.ensure_space(20)
        self.draw_rect(self.margin_left + 6, self.y + 3, 4, 4, fill_color=(0/255, 122/255, 255/255))
        full_text = f"{title}: {text}" if title else text
        self.add_wrapped_text(full_text, font_size=9.5, font_name="F1", color=(51/255, 65/255, 85/255), line_height=13.5, indent=18)
        self.y -= 3

    def add_callout(self, title, text, bg_color=(240/255, 244/255, 248/255), border_color=(0/255, 122/255, 255/255)):
        # Calculate text wrapping first to know height
        char_width = 9.5 * 0.50
        max_chars = int((self.usable_width - 24) / char_width)
        words = text.split(" ")
        lines = []
        current_line = []
        current_length = 0
        for word in words:
            if current_length + len(word) + (1 if current_line else 0) <= max_chars:
                current_line.append(word)
                current_length += len(word) + (1 if len(current_line) > 1 else 0)
            else:
                if current_line:
                    lines.append(" ".join(current_line))
                current_line = [word]
                current_length = len(word)
        if current_line:
            lines.append(" ".join(current_line))

        box_height = 20 + len(lines) * 14 + 10
        self.ensure_space(box_height + 10)
        
        box_y = self.y - box_height
        self.draw_rect(self.margin_left, box_y, self.usable_width, box_height, fill_color=bg_color, stroke_color=(220/255, 226/255, 235/255), stroke_width=0.8)
        self.draw_rect(self.margin_left, box_y, 4, box_height, fill_color=border_color)
        
        text_y = self.y - 16
        self.add_text(title, self.margin_left + 14, text_y, font_size=10.5, font_name="F2", color=(15/255, 23/255, 42/255))
        text_y -= 15
        for line in lines:
            self.add_text(line, self.margin_left + 14, text_y, font_size=9.5, font_name="F1", color=(51/255, 65/255, 85/255))
            text_y -= 14
        
        self.y = box_y - 12

    def add_table(self, headers, rows, col_widths):
        table_height = 24 + len(rows) * 20
        self.ensure_space(table_height + 10)
        
        y_top = self.y
        # Header row background
        self.draw_rect(self.margin_left, y_top - 20, self.usable_width, 20, fill_color=(241/255, 245/255, 249/255), stroke_color=(203/255, 213/255, 225/255))
        
        x_curr = self.margin_left
        for idx, h in enumerate(headers):
            w = col_widths[idx]
            self.add_text(h, x_curr + 6, y_top - 14, font_size=9, font_name="F2", color=(15/255, 23/255, 42/255))
            x_curr += w
            
        y_curr = y_top - 20
        for r_idx, row in enumerate(rows):
            bg = (255/255, 255/255, 255/255) if r_idx % 2 == 0 else (248/255, 250/255, 252/255)
            self.draw_rect(self.margin_left, y_curr - 20, self.usable_width, 20, fill_color=bg, stroke_color=(226/255, 232/255, 240/255))
            x_curr = self.margin_left
            for c_idx, val in enumerate(row):
                w = col_widths[c_idx]
                font = "F2" if c_idx == 0 else "F1"
                self.add_text(val, x_curr + 6, y_curr - 14, font_size=8.5, font_name=font, color=(51/255, 65/255, 85/255))
                x_curr += w
            y_curr -= 20
            
        self.y = y_curr - 12

    def save(self):
        if self.current_stream:
            self.pages.append(self.current_stream)

        pdf_objects = []
        
        # Obj 1: Catalog
        pdf_objects.append("1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj")
        
        # Obj 2: Pages
        page_refs = [f"{i+3} 0 R" for i in range(len(self.pages))]
        pdf_objects.append(f"2 0 obj\n<< /Type /Pages /Kids [{' '.join(page_refs)}] /Count {len(self.pages)} >>\nendobj")
        
        # Obj 3..N: Page objects + Content streams
        # Obj N+1: Font F1 (Helvetica)
        # Obj N+2: Font F2 (Helvetica-Bold)
        font1_obj_num = 3 + len(self.pages) * 2
        font2_obj_num = font1_obj_num + 1

        for i, page_content in enumerate(self.pages):
            page_obj_num = 3 + i * 2
            stream_obj_num = page_obj_num + 1
            stream_data = "\n".join(page_content)
            stream_len = len(stream_data.encode('utf-8'))
            
            page_obj = (
                f"{page_obj_num} 0 obj\n"
                f"<< /Type /Page /Parent 2 0 R\n"
                f"   /MediaBox [0 0 {self.width:.2f} {self.height:.2f}]\n"
                f"   /Contents {stream_obj_num} 0 R\n"
                f"   /Resources << /Font << /F1 {font1_obj_num} 0 R /F2 {font2_obj_num} 0 R >> >>\n"
                f">>\nendobj"
            )
            stream_obj = (
                f"{stream_obj_num} 0 obj\n"
                f"<< /Length {stream_len} >>\n"
                f"stream\n{stream_data}\nendstream\nendobj"
            )
            pdf_objects.append(page_obj)
            pdf_objects.append(stream_obj)

        pdf_objects.append(f"{font1_obj_num} 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj")
        pdf_objects.append(f"{font2_obj_num} 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>\nendobj")

        # Assemble PDF file with cross-reference table
        body = "%PDF-1.4\n"
        offsets = []
        for obj in pdf_objects:
            offsets.append(len(body.encode('utf-8')))
            body += obj + "\n"

        xref_offset = len(body.encode('utf-8'))
        body += f"xref\n0 {len(pdf_objects) + 1}\n"
        body += "0000000000 65535 f \n"
        for off in offsets:
            body += f"{off:010d} 00000 n \n"
        body += f"trailer\n<< /Size {len(pdf_objects) + 1} /Root 1 0 R >>\n"
        body += f"startxref\n{xref_offset}\n%%EOF\n"

        with open(self.filename, "wb") as f:
            f.write(body.encode('utf-8'))

        print(f"PDF successfully generated: {self.filename} ({len(self.pages)} pages)")

def generate_report():
    output_path = "/Users/prabhmehardhalio/Desktop/smart-menu-main/Smart_Menu_Service_Window_QR_Architecture.pdf"
    pdf = SimplePDFBuilder(output_path)
    
    # Cover Header Banner
    pdf.draw_rect(pdf.margin_left, pdf.y - 75, pdf.usable_width, 75, fill_color=(15/255, 23/255, 42/255))
    pdf.add_text("SMART MENU SYSTEM ARCHITECTURE", pdf.margin_left + 16, pdf.y - 28, font_size=15, font_name="F2", color=(214/255, 255/255, 0/255))
    pdf.add_text("Service Window QR Codes, Table Identification & Fraud Prevention Strategy", pdf.margin_left + 16, pdf.y - 48, font_size=10, font_name="F1", color=(255/255, 255/255, 255/255))
    pdf.add_text("Project: smart-menu-main  |  Date: September 2026", pdf.margin_left + 16, pdf.y - 64, font_size=8, font_name="F1", color=(148/255, 163/255, 184/255))
    pdf.y -= 90

    # Executive Summary
    pdf.add_heading_1("1. Executive Summary")
    pdf.add_wrapped_text(
        "This architectural report provides a comprehensive evaluation of introducing a Service Window (Counter / Takeaway / Kiosk) QR Code alongside traditional Table QR Codes in the Smart Menu system. It outlines technical workflows, table identification strategies, fraud prevention mechanisms, and code modification guidelines tailored for the smart-menu-main codebase.",
        font_size=9.5, line_height=14
    )
    pdf.y -= 4

    # Section 2: Core Concept
    pdf.add_heading_1("2. Service Window QR Code Overview")
    pdf.add_wrapped_text(
        "A Service Window QR code allows customers entering the venue, waiting in line, or standing at an order counter to immediately scan and view the menu without first sitting down at a specific table.",
        font_size=9.5, line_height=14
    )
    pdf.y -= 4
    pdf.add_bullet("Purpose", "Accelerates menu browsing, enables takeaway/counter ordering, and reduces waiter response time.")
    pdf.add_bullet("Token Structure", "Encodes a JWT payload with table_id = 'COUNTER' or 'SERVICE_WINDOW' (e.g. {\"menu_id\": \"m1\", \"table_id\": \"COUNTER\"}).")
    pdf.add_bullet("Verification Flow", "Scanned via ScanVerifier.jsx and validated against the backend /api/verify-scan endpoint.")
    pdf.y -= 6

    # Section 3: Table Identification Models
    pdf.add_heading_1("3. Table Identification Mechanisms")
    pdf.add_wrapped_text(
        "When an order originates from a Service Window QR code, the system must determine where the food should be served. Three distinct models can be supported:",
        font_size=9.5, line_height=14
    )
    pdf.y -= 6

    pdf.add_callout(
        "Model A: Counter Pickup / Order Callout (No Table Assigned)",
        "The order is tagged with table_id = 'COUNTER'. When prepared, the kitchen updates the status to 'ready' on the admin portal. Customers collect their food from the window when their Order Number is displayed or called out.",
        bg_color=(248/255, 250/255, 252/255), border_color=(59/255, 130/255, 246/255)
    )

    pdf.add_callout(
        "Model B: Manual Table Input at Checkout",
        "The customer scans the Service Window QR, builds their cart, and selects 'Dine-In' at checkout. A modal prompts them to enter their Table Number (e.g., Table 1–20). The order payload posts customer_selected_table_id to /api/order.",
        bg_color=(248/255, 250/255, 252/255), border_color=(16/255, 185/255, 129/255)
    )

    pdf.add_callout(
        "Model C: Two-Step Dynamic Table Pairing (Recommended)",
        "The customer scans the Service Window QR while standing in line to build a cart. Once seated, they tap 'Pair Table' inside the web app and scan the physical Table QR code. The session token upgrades from 'COUNTER' to 'TABLE_5'.",
        bg_color=(248/255, 250/255, 252/255), border_color=(139/255, 92/255, 246/255)
    )

    # Section 4: Security & Fraud Prevention
    pdf.add_heading_1("4. Security & Anti-Abuse Strategy")
    pdf.add_wrapped_text(
        "Allowing customers to order without being pre-locked to a table introduces potential fraud risks (e.g., placing fake orders to random tables). Below is the recommended multi-layered security strategy:",
        font_size=9.5, line_height=14
    )
    pdf.y -= 4

    pdf.add_bullet("1. Mandatory Pre-Payment", "Require digital pre-payment (Stripe/UPI/Apple Pay) for counter or manual table orders. Once paid, kitchen waste risk is zero regardless of table placement.")
    pdf.add_bullet("2. JWT Signed Tokens", "Table QR codes remain tamper-proof. Manual override requires cashier approval or valid JWT scanning.")
    pdf.add_bullet("3. Geofence Proximity Check", "Leverages the existing 200m GPS verification in /api/verify-scan to block remote off-site spam orders.")
    pdf.add_bullet("4. Staff Order Approval", "Unpaid cash orders remain in 'pending_approval' until floor staff verify the table before kitchen preparation.")
    pdf.y -= 6

    # Section 5: Architectural Comparison Table
    pdf.add_heading_1("5. Model Comparison Matrix")
    
    headers = ["Model", "Primary Use Case", "UX Effort", "Fraud Risk", "Recommended Safeguard"]
    rows = [
        ["Model A: Counter Callout", "Takeaway / Fast Food", "Minimal", "Very Low", "Order Callout Screen"],
        ["Model B: Manual Table Input", "Casual Dining", "Low", "Medium", "Mandatory Digital Payment"],
        ["Model C: Dynamic Pairing", "Full Service Dining", "Medium", "Zero", "JWT Table Rescan / Pair"]
    ]
    col_widths = [110, 100, 65, 65, 1655]
    # adjust widths to fit usable_width = 505.28
    col_widths = [115, 95, 60, 60, 175]
    pdf.add_table(headers, rows, col_widths)

    # Section 6: Action Plan & Code Modifications
    pdf.add_heading_1("6. Recommended Code Modifications")
    pdf.add_wrapped_text(
        "To implement the Service Window QR code feature in smart-menu-main, apply the following updates:",
        font_size=9.5, line_height=14
    )
    pdf.y -= 4

    pdf.add_bullet("backend/main.py", "Add endpoint /api/tables/counter-token to generate a perpetual or reset-capable JWT token for the service window with table_id = 'COUNTER'.")
    pdf.add_bullet("frontend/.../CustomerMenuApp.jsx", "Add state for isCounterSession and a checkout table selector modal if table_id === 'COUNTER'.")
    pdf.add_bullet("frontend/.../TablesPage.jsx", "Add a 'Download Service Window QR' button alongside table QRs in the admin portal.")

    # Save PDF
    pdf.save()
    
    # Copy to brain artifact directory as well
    artifact_dir = "/Users/prabhmehardhalio/.gemini/antigravity/brain/8ab91bdd-1114-4f5e-aa59-d766be68b1d2"
    if os.path.exists(artifact_dir):
        import shutil
        target_art = os.path.join(artifact_dir, "Smart_Menu_Service_Window_QR_Architecture.pdf")
        shutil.copyfile(output_path, target_art)
        print(f"Copied PDF to artifact directory: {target_art}")

if __name__ == "__main__":
    generate_report()
