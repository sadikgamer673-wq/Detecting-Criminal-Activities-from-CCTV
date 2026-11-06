import matplotlib.pyplot as plt
import matplotlib.patches as patches
from pathlib import Path

def draw_architecture_diagram(output_png: Path):
    fig, ax = plt.subplots(figsize=(8.2, 10.8), dpi=300)
    ax.set_xlim(0, 100)
    ax.set_ylim(0, 100)
    ax.axis('off')

    # Color Palette: Clean Academic / Enterprise Styling
    c_bg_main = '#F8FAFC'      # Slate 50
    c_border_main = '#1E3A8A'  # Deep Navy Blue
    c_header_fill = '#1E3A8A'  # Deep Navy Blue
    c_sub_bg = '#FFFFFF'       # Pure White
    c_sub_border = '#94A3B8'   # Slate 400
    c_arrow = '#0F172A'        # Slate 900
    c_sub_text = '#1E293B'     # Slate 800

    def draw_layer_box(y_top, height, title, sub_boxes, is_split=False):
        # Main Layer Outer Box
        box_width = 86
        x_left = 7
        
        # Outer Rectangle
        rect = patches.FancyBboxPatch(
            (x_left, y_top - height), box_width, height,
            boxstyle="round,pad=0.5,rounding_size=1.2",
            facecolor=c_bg_main, edgecolor=c_border_main, linewidth=1.8
        )
        ax.add_patch(rect)

        # Header Title Banner
        hdr_h = 2.6
        hdr_rect = patches.FancyBboxPatch(
            (x_left, y_top - hdr_h), box_width, hdr_h,
            boxstyle="round,pad=0.2,rounding_size=0.8",
            facecolor=c_header_fill, edgecolor=c_header_fill, linewidth=1
        )
        ax.add_patch(hdr_rect)
        ax.text(x_left + box_width/2, y_top - hdr_h/2 - 0.2, title,
                ha='center', va='center', fontsize=10.5, fontweight='bold', color='white', fontfamily='sans-serif')

        # Sub boxes inside
        cur_y = y_top - hdr_h - 1.0
        for sb in sub_boxes:
            if isinstance(sb, list):
                # Horizontal distribution
                n = len(sb)
                gap = 1.8
                avail_w = box_width - 3.0 - (gap * (n - 1))
                w_each = avail_w / n
                sb_h = 3.6
                for i, text in enumerate(sb):
                    sb_x = x_left + 1.5 + i * (w_each + gap)
                    s_rect = patches.FancyBboxPatch(
                        (sb_x, cur_y - sb_h), w_each, sb_h,
                        boxstyle="round,pad=0.3,rounding_size=0.8",
                        facecolor=c_sub_bg, edgecolor=c_sub_border, linewidth=1.1
                    )
                    ax.add_patch(s_rect)
                    ax.text(sb_x + w_each/2, cur_y - sb_h/2, text,
                            ha='center', va='center', fontsize=8.5, fontweight='bold', color=c_sub_text, fontfamily='sans-serif')
                cur_y -= (sb_h + 1.0)
            else:
                # Single full-width inner row
                sb_h = 2.8
                s_rect = patches.FancyBboxPatch(
                    (x_left + 2.0, cur_y - sb_h), box_width - 4.0, sb_h,
                    boxstyle="round,pad=0.3,rounding_size=0.8",
                    facecolor=c_sub_bg, edgecolor=c_sub_border, linewidth=1.1
                )
                ax.add_patch(s_rect)
                ax.text(x_left + box_width/2, cur_y - sb_h/2, sb,
                        ha='center', va='center', fontsize=8.5, fontweight='bold' if 'Model' in sb or 'FastAPI' in sb or 'React' in sb else 'normal',
                        color=c_sub_text, fontfamily='sans-serif')
                cur_y -= (sb_h + 0.8)

    def draw_split_layer(y_top, height):
        # Two side-by-side boxes: Incident Management (Left) and Data Storage (Right)
        w = 41.5
        gap = 3.0
        x1 = 7.0
        x2 = x1 + w + gap

        # Left: Incident Management
        rect1 = patches.FancyBboxPatch(
            (x1, y_top - height), w, height,
            boxstyle="round,pad=0.5,rounding_size=1.2",
            facecolor='#EFF6FF', edgecolor='#2563EB', linewidth=1.6
        )
        ax.add_patch(rect1)
        ax.text(x1 + w/2, y_top - 2.0, "INCIDENT MANAGEMENT", ha='center', va='center', fontsize=9.5, fontweight='bold', color='#1E40AF')
        
        # Sub box 1
        s1 = patches.FancyBboxPatch((x1 + 2, y_top - 5.4), w - 4, 2.5, boxstyle="round,pad=0.2,rounding_size=0.6", facecolor='white', edgecolor='#93C5FD', linewidth=1)
        ax.add_patch(s1)
        ax.text(x1 + w/2, y_top - 4.15, "Organize Detection Results", ha='center', va='center', fontsize=8, color='#1E293B')

        s2 = patches.FancyBboxPatch((x1 + 2, y_top - 8.6), w - 4, 2.5, boxstyle="round,pad=0.2,rounding_size=0.6", facecolor='white', edgecolor='#93C5FD', linewidth=1)
        ax.add_patch(s2)
        ax.text(x1 + w/2, y_top - 7.35, "Review Available Alerts", ha='center', va='center', fontsize=8, color='#1E293B')

        # Right: Data Storage
        rect2 = patches.FancyBboxPatch(
            (x2, y_top - height), w, height,
            boxstyle="round,pad=0.5,rounding_size=1.2",
            facecolor='#F0FDF4', edgecolor='#16A34A', linewidth=1.6
        )
        ax.add_patch(rect2)
        ax.text(x2 + w/2, y_top - 2.0, "DATA STORAGE", ha='center', va='center', fontsize=9.5, fontweight='bold', color='#15803D')

        # Sub box 2
        s3 = patches.FancyBboxPatch((x2 + 2, y_top - 5.4), w - 4, 2.5, boxstyle="round,pad=0.2,rounding_size=0.6", facecolor='white', edgecolor='#86EFAC', linewidth=1)
        ax.add_patch(s3)
        ax.text(x2 + w/2, y_top - 4.15, "SQLite Database (WAL Mode)", ha='center', va='center', fontsize=8, color='#1E293B')

        s4 = patches.FancyBboxPatch((x2 + 2, y_top - 8.6), w - 4, 2.5, boxstyle="round,pad=0.2,rounding_size=0.6", facecolor='white', edgecolor='#86EFAC', linewidth=1)
        ax.add_patch(s4)
        ax.text(x2 + w/2, y_top - 7.35, "SQLAlchemy Database Access Engine", ha='center', va='center', fontsize=8, color='#1E293B')

    def draw_down_arrow(y_start, y_end, x=50):
        ax.annotate('', xy=(x, y_end), xytext=(x, y_start),
                    arrowprops=dict(facecolor=c_arrow, edgecolor=c_arrow, width=1.4, headwidth=6, headlength=7))

    # --- LAYERS LAYOUT (from top to bottom) ---
    # 1. INPUT LAYER (y: 98 -> 88.5)
    draw_layer_box(
        y_top=98, height=9.5, title="INPUT LAYER",
        sub_boxes=[
            ["CCTV / IP Camera\nStream", "Webcam / USB\nCamera", "Uploaded Video\nFiles"]
        ]
    )
    draw_down_arrow(88.5, 86.0)

    # 2. VIDEO PROCESSING LAYER (y: 86 -> 76.5)
    draw_layer_box(
        y_top=86, height=9.5, title="VIDEO PROCESSING LAYER",
        sub_boxes=[
            "OpenCV Video Capture and Frame Extraction",
            "Frame Preparation and Input Validation"
        ]
    )
    draw_down_arrow(76.5, 74.0)

    # 3. AI DETECTION LAYER (y: 74 -> 60.5)
    draw_layer_box(
        y_top=74, height=13.5, title="AI DETECTION LAYER",
        sub_boxes=[
            "Configured YOLO Detection Model (YOLOv8n CPU Engine)",
            "Person Detection  |  Supported Weapon Detection",
            "Bounding Boxes  |  Class Labels  |  Confidence Scores"
        ]
    )
    draw_down_arrow(60.5, 58.0)

    # 4. BACKEND APPLICATION LAYER (y: 58 -> 48.0)
    draw_layer_box(
        y_top=58, height=10.0, title="BACKEND APPLICATION LAYER",
        sub_boxes=[
            "FastAPI Backend Framework",
            "Request Handling  |  Result Processing  |  API Communication"
        ]
    )

    # Split Arrows from Backend to Split Boxes
    ax.annotate('', xy=(27.75, 45.0), xytext=(40.0, 48.0),
                arrowprops=dict(facecolor=c_arrow, edgecolor=c_arrow, width=1.3, headwidth=5, headlength=6))
    ax.annotate('', xy=(72.25, 45.0), xytext=(60.0, 48.0),
                arrowprops=dict(facecolor=c_arrow, edgecolor=c_arrow, width=1.3, headwidth=5, headlength=6))

    # 5. SPLIT: INCIDENT MANAGEMENT & DATA STORAGE (y: 45 -> 34.5)
    draw_split_layer(y_top=45, height=10.5)

    # Converging Arrows from Split Boxes to Presentation Layer
    ax.annotate('', xy=(42.0, 31.5), xytext=(27.75, 34.5),
                arrowprops=dict(facecolor=c_arrow, edgecolor=c_arrow, width=1.3, headwidth=5, headlength=6))
    ax.annotate('', xy=(58.0, 31.5), xytext=(72.25, 34.5),
                arrowprops=dict(facecolor=c_arrow, edgecolor=c_arrow, width=1.3, headwidth=5, headlength=6))

    # 6. PRESENTATION LAYER (y: 31.5 -> 21.5)
    draw_layer_box(
        y_top=31.5, height=10.0, title="PRESENTATION LAYER",
        sub_boxes=[
            "React Web Interface (Vite + TypeScript Single-Page Application)",
            "Video Display  |  Detection Results  |  Incident Information"
        ]
    )
    draw_down_arrow(21.5, 19.0)

    # 7. HUMAN REVIEW (y: 19.0 -> 10.0)
    # Highlighted Box in Gold / Amber
    box_w = 86
    x_l = 7
    h_box = patches.FancyBboxPatch(
        (x_l, 10.0), box_w, 9.0,
        boxstyle="round,pad=0.5,rounding_size=1.2",
        facecolor='#FFFBEB', edgecolor='#D97706', linewidth=1.8
    )
    ax.add_patch(h_box)

    # Header
    ax.text(50, 16.8, "HUMAN REVIEW", ha='center', va='center', fontsize=10.5, fontweight='bold', color='#B45309')
    ax.text(50, 14.1, "Authorized User Reviews Potential Detection Alerts", ha='center', va='center', fontsize=8.8, fontweight='bold', color='#1E293B')
    ax.text(50, 11.9, "and Determines Whether Further Investigation Is Needed", ha='center', va='center', fontsize=8.8, color='#475569')

    # Caption Figure 5.1.1
    ax.text(50, 5.2, "Fig 5.1.1 Architectural Representation", ha='center', va='center', fontsize=11.5, fontweight='bold', fontfamily='serif', color='#0F172A')

    plt.tight_layout()
    plt.savefig(str(output_png), dpi=300, bbox_inches='tight', pad_inches=0.1)
    plt.close()
    print(f"Generated High-Res Architecture Diagram: {output_png}")

if __name__ == '__main__':
    out = Path(r"c:\Users\sadik\Documents\antigravity\adventurous-raman\architecture_diagram.png")
    draw_architecture_diagram(out)
