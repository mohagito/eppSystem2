import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import { 
  Printer, 
  Settings2, 
  Calendar, 
  User, 
  Tag, 
  CheckCircle2, 
  Barcode,
  Truck,
  Layers,
  FileCheck
} from 'lucide-react';
import { AIRBAG_MODELS } from '../data';
import { UserProfile } from '../types';

interface LabelGeneratorProps {
  currentUser: UserProfile;
}

export default function LabelGenerator({ currentUser }: LabelGeneratorProps) {
  // 1. Form States matching specifications exactly
  const [selectedModel, setSelectedModel] = useState<string>('BCB');
  const [piecesQty, setPiecesQty] = useState<number>(1000);
  const [creationDate, setCreationDate] = useState<string>(() => {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  });
  const [assignedOperator, setAssignedOperator] = useState<string>(currentUser?.name || 'Gonzalo');
  const [packagingType, setPackagingType] = useState<string>('CARDBOARD BOX');
  const [qaStatus, setQaStatus] = useState<string>('APPROVED QUALITY');
  const [serialCode, setSerialCode] = useState<string>('');
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>('');

  // Suffix/hash for batch serial code that is unique per session but stable
  const [serialSuffix] = useState<string>(() => {
    return Math.floor(1000 + Math.random() * 9000).toString();
  });

  // 2. Dynamically calculate Batch Serial Code
  useEffect(() => {
    // Format creationdate from YYYY-MM-DD to YYYYMMDD
    const dateStr = creationDate.replace(/-/g, '');
    const code = `EPP-${selectedModel}-${dateStr}-${serialSuffix}`;
    setSerialCode(code);
  }, [selectedModel, creationDate, serialSuffix]);

  // 3. Render real-time QR Code
  useEffect(() => {
    if (serialCode) {
      QRCode.toDataURL(serialCode, {
        margin: 1,
        width: 180,
        color: {
          dark: '#000000',
          light: '#ffffff',
        },
      })
      .then((url) => {
        setQrCodeDataUrl(url);
      })
      .catch((err) => {
        console.error('Error generating QR Code', err);
      });
    }
  }, [serialCode]);

  // 4. Handle standard print action
  const handlePrint = () => {
    window.print();
  };

  // Quick Preset Actions
  const applyPresetQty = (qty: number) => {
    setPiecesQty(qty);
  };

  return (
    <div className="space-y-6" id="label-generator-container">
      {/* Dynamic Print Styles for exact thermal standard label printing format */}
      <style>{`
        @media print {
          /* Force physical document settings to avoid double sheets of paper */
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            height: 6in !important;
            width: 4in !important;
            overflow: hidden !important;
            background-color: #ffffff !important;
          }

          /* Hide default page layout headers, footers and all outside wrapper elements cleanly */
          #desktop-sidebar,
          #mobile-header,
          #label-gen-header,
          #label-specs-panel,
          #label-preview-panel > span,
          button,
          .swal2-container,
          #toast-container {
            display: none !important;
          }

          /* Reset all parent layouts of the card so it gets placed at absolute top-left without pushing */
          #root, 
          #app-interior, 
          #app-main-content, 
          #label-generator-container, 
          #label-gen-body, 
          #label-preview-panel {
            display: block !important;
            position: absolute !important;
            top: 0 !important;
            left: 0 !important;
            width: 4in !important;
            height: 6in !important;
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
            box-shadow: none !important;
            border: none !important;
          }

          /* High density thermal sticker page container positioning */
          #print-sticker-card {
            display: flex !important;
            position: absolute !important;
            left: 0.12in !important;
            top: 0.12in !important;
            width: 3.76in !important;
            height: 5.76in !important;
            background: #ffffff !important;
            border: 3.5px solid #000000 !important;
            border-radius: 12px !important;
            box-shadow: none !important;
            margin: 0 !important;
            padding: 15px !important;
            box-sizing: border-box !important;
            flex-direction: column !important;
            justify-content: space-between !important;
            overflow: hidden !important;
            page-break-inside: avoid !important;
            page-break-after: avoid !important;
          }

          /* Compress margins vertically to keep absolute 100% single page fit */
          #print-sticker-card .my-4,
          #print-sticker-card .my-5 {
            margin-top: 5px !important;
            margin-bottom: 5px !important;
          }

          /* Custom scaling for QR code to fit beautifully */
          #print-sticker-card #print-qr-container {
            padding: 4px !important;
            border-width: 2.5px !important;
            border-color: #000000 !important;
          }
          #print-sticker-card #print-qr-image {
            width: 95px !important;
            height: 95px !important;
          }

          /* High contrast conversions to avoid fuzzy dithered light grey on thermoshield prints */
          #print-sticker-card .text-slate-400,
          #print-sticker-card .text-slate-450,
          #print-sticker-card .text-slate-500 {
            color: #000000 !important;
            font-weight: 800 !important;
          }
          #print-sticker-card .border-slate-450 {
            border-color: #000000 !important;
          }

          /* Barcode and bottom metadata sizing to prevent overlaps */
          #print-sticker-card #sticker-barcode {
            width: 92px !important;
            height: auto !important;
            display: flex !important;
            flex-direction: column !important;
            align-items: center !important;
            justify-content: flex-end !important;
          }
          #print-sticker-card #sticker-barcode svg {
            width: 92px !important;
            height: 28px !important;
          }

          /* Force backgrounds, borders, and dark colors to show up perfectly in PDF or physical print */
          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            color-adjust: exact !important;
          }

          @page {
            size: 4in 6in;
            margin: 0;
          }
        }
      `}</style>

      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-5" id="label-gen-header">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-emerald-100 text-emerald-800 rounded-xl shadow-xs">
            <Printer className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
              Barcode & QR Code Label Generator
            </h1>
            <p className="text-xs text-slate-500 font-bold mt-1">
              Print high-contrast thermo-adhesive sticker labels for plastic bags and storage boxes.
            </p>
          </div>
        </div>

        {/* Global Print CTA floating inside dashboard */}
        <button
          onClick={handlePrint}
          className="flex items-center justify-center gap-2 px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-black rounded-xl shadow-md cursor-pointer transition-all active:scale-98"
          id="global-print-btn"
        >
          <Printer className="w-4 h-4" />
          <span>Print Custom Label</span>
        </button>
      </div>

      {/* MAIN TWO-COLUMN CONFIGURATOR GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start" id="label-gen-body">
        
        {/* LEFT COLUMN: LABEL CONFIGURATION INPUTS */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-6" id="label-specs-panel">
          
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <Settings2 className="w-4 h-4 text-slate-400" />
            <h2 className="text-xs font-black text-slate-700 tracking-wider uppercase">
              Label Specifications
            </h2>
          </div>

          <div className="space-y-4">
            
            {/* Airbag Reference Model Dropdown */}
            <div className="space-y-1.5">
              <label className="text-[10.5px] font-black text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5 text-slate-400" />
                Airbag Reference Model
              </label>
              <select
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                className="w-full bg-slate-50 border border-slate-250 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 focus:outline-hidden text-xs py-2.5 px-3 rounded-xl text-slate-800 font-bold cursor-pointer transition-all"
                id="spec-model-select"
              >
                {AIRBAG_MODELS.map((model) => (
                  <option key={model} value={model}>
                    {model}
                  </option>
                ))}
              </select>
            </div>

            {/* Pieces Quantity Input and Standard Presets Row */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-[10.5px] font-black text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-slate-400" />
                  Package Pieces (Quantity)
                </label>
                <button 
                  type="button"
                  onClick={() => applyPresetQty(1000)}
                  className="text-[10px] text-emerald-600 hover:text-emerald-700 font-extrabold cursor-pointer transition-all focus:outline-hidden"
                >
                  Apply Standard (1000 pcs)
                </button>
              </div>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="number"
                  min="1"
                  max="5000"
                  value={piecesQty}
                  onChange={(e) => setPiecesQty(parseInt(e.target.value) || 0)}
                  className="w-full sm:flex-1 bg-slate-50 border border-slate-250 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 focus:outline-hidden text-xs py-2.5 px-3 rounded-xl text-slate-800 font-bold transition-all"
                  id="spec-qty-input"
                />
                
                {/* Micro Preset selectors matching screen specs */}
                <div className="flex gap-1.5 shrink-0 overflow-x-auto pb-1 sm:pb-0" id="spec-presets-row">
                  {[1000, 300, 600, 2400].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => applyPresetQty(preset)}
                      className={`px-3 py-2 border rounded-xl text-xs font-extrabold transition-all cursor-pointer whitespace-nowrap ${
                        piecesQty === preset 
                          ? 'bg-emerald-50 border-emerald-500 text-emerald-700' 
                          : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Label Creation Date Input Selection */}
            <div className="space-y-1.5">
              <label className="text-[10.5px] font-black text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                Label Creation Date
              </label>
              <div className="relative">
                <input
                  type="date"
                  value={creationDate}
                  onChange={(e) => setCreationDate(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-250 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 focus:outline-hidden text-xs py-2.5 px-3 rounded-xl text-slate-800 font-bold cursor-pointer transition-all"
                  id="spec-date-input"
                />
              </div>
            </div>

            {/* Assigned Operator Selection Name */}
            <div className="space-y-1.5">
              <label className="text-[10.5px] font-black text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-slate-400" />
                Assigned Operator
              </label>
              <input
                type="text"
                value={assignedOperator}
                onChange={(e) => setAssignedOperator(e.target.value)}
                placeholder="Operator name..."
                className="w-full bg-slate-50 border border-slate-250 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 focus:outline-hidden text-xs py-2.5 px-3 rounded-xl text-slate-800 font-bold transition-all"
                id="spec-operator-input"
              />
            </div>

            {/* Packaging Type and QA Status Dropdowns Grid layout */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              
              {/* Packaging Type Selector */}
              <div className="space-y-1.5">
                <label className="text-[10.5px] font-black text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                  <Truck className="w-3.5 h-3.5 text-slate-400" />
                  Packaging Type
                </label>
                <select
                  value={packagingType}
                  onChange={(e) => setPackagingType(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-250 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 focus:outline-hidden text-xs py-2.5 px-3 rounded-lg text-slate-800 font-bold cursor-pointer transition-all"
                  id="spec-packing-select"
                >
                  <option value="PLASTIC BAG">PLASTIC BAG</option>
                  <option value="CARDBOARD BOX">BOX / CARTON</option>
                  <option value="WOODEN PALLET">WOODEN PALLET</option>
                  <option value="PLASTIC BIN">PLASTIC BIN</option>
                </select>
              </div>

              {/* QA Status Selector */}
              <div className="space-y-1.5">
                <label className="text-[10.5px] font-black text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                  <FileCheck className="w-3.5 h-3.5 text-slate-400" />
                  QA Status Remarks
                </label>
                <select
                  value={qaStatus}
                  onChange={(e) => setQaStatus(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-250 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 focus:outline-hidden text-xs py-2.5 px-3 rounded-lg text-slate-800 font-bold cursor-pointer transition-all"
                  id="spec-qa-select"
                >
                  <option value="APPROVED QUALITY">APPROVED QUALITY</option>
                  <option value="PENDING AUDIT">PENDING AUDIT</option>
                  <option value="REJECTED DEVIATION">REJECTED / DAMAGED</option>
                </select>
              </div>

            </div>

            {/* Auto Generated Batch Serial Code Bar */}
            <div className="space-y-1.5 pt-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block">
                Auto Generated Batch Serial Code
              </label>
              <input
                type="text"
                readOnly
                value={serialCode}
                className="w-full bg-slate-100 border border-slate-200 text-xs py-2.5 px-3.5 rounded-xl font-mono text-slate-650 font-bold tracking-wider select-all outline-hidden"
                id="spec-serial-preview"
              />
            </div>

          </div>

        </div>

        {/* RIGHT COLUMN: HIGH-POLISHED LIVE THERMAL STICKER PREVIEW */}
        <div className="lg:col-span-7 flex flex-col items-center justify-center space-y-4" id="label-preview-panel">
          
          {/* Section banner */}
          <span className="text-[11px] font-black font-mono text-slate-400 uppercase tracking-widest">
            --- Live Thermal Printer Label Preview ---
          </span>

          {/* THE PRINTABLE CARD CONTAINER */}
          <div 
            className="w-full max-w-[420px] bg-white border border-slate-350 shadow-xl rounded-2xl p-6 text-black select-none font-sans flex flex-col justify-between transition-all"
            id="print-sticker-card"
          >
            {/* STICKER ROW 1: BRAND LOGO HEADER & PACKAGING BAG BADGE */}
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-0.5">
                <h3 className="text-xl font-black text-black tracking-tight leading-none uppercase">
                  E.P.P. NATUR
                </h3>
              </div>
              
              <div className="px-3 py-1.5 bg-black text-white text-[10px] font-black rounded-sm uppercase tracking-wide leading-none min-w-[90px] text-center">
                {packagingType}
              </div>
            </div>

            {/* THICK BLACK SOLID BOUNDARY BAR */}
            <div className="w-full h-[3px] bg-black my-4" />

            {/* STICKER ROW 2: REFERENCE MODEL LABEL & GIANT CODE TEXT */}
            <div className="space-y-1">
              <span className="text-[9px] font-black tracking-widest text-slate-400 uppercase block">
                Reference Reference / Model
              </span>
              <h2 className="text-5xl font-black text-black tracking-tighter leading-none uppercase">
                {selectedModel}
              </h2>
            </div>

            {/* SHARP Dotted Divider line */}
            <div className="w-full border-t border-dashed border-slate-450 my-4" />

            {/* STICKER ROW 3: QUANTITY COUNTER & QA BADGE GRID */}
            <div className="grid grid-cols-2 gap-4 items-center">
              
              {/* Pieces quantities */}
              <div className="space-y-1">
                <span className="text-[9px] font-black tracking-widest text-slate-400 uppercase block">
                  Pieces (Qty)
                </span>
                <div className="flex items-baseline gap-1">
                  <span className="text-5xl font-black text-black leading-none">
                    {piecesQty}
                  </span>
                  <span className="text-[10px] font-black text-slate-500 uppercase">
                    Pcs / Unid.
                  </span>
                </div>
              </div>

              {/* Bold QA solid stamp verification */}
              <div className="space-y-1">
                <span className="text-[9px] font-black tracking-widest text-slate-400 uppercase block">
                  QA Verification
                </span>
                <div className="w-full py-3.5 bg-black text-white text-center rounded-sm font-black text-xs uppercase tracking-wider flex items-center justify-center px-2 shadow-xs border border-transparent">
                  {qaStatus}
                </div>
              </div>

            </div>

            {/* SHARP Dotted Divider line */}
            <div className="w-full border-t border-dashed border-slate-450 my-5" />

            {/* STICKER ROW 4: INTERACTIVE DYNAMIC QR CODE DISPLAY */}
            <div className="flex flex-col items-center justify-center space-y-2">
              <div id="print-qr-container" className="p-2.5 bg-white border-2 border-black rounded-lg inline-block shadow-sm">
                {qrCodeDataUrl ? (
                  <img 
                    id="print-qr-image"
                    src={qrCodeDataUrl} 
                    alt="Traceability QR Code" 
                    className="w-36 h-36 object-contain"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-36 h-36 bg-slate-50 flex items-center justify-center border border-slate-150 rounded-md">
                    <span className="text-[10px] font-mono text-slate-400">Gen QR...</span>
                  </div>
                )}
              </div>
              <span className="text-[9px] font-bold font-mono tracking-wider text-slate-500 uppercase">
                Scan to Instantly Add to Stock
              </span>
            </div>

            {/* THICK BLACK DIVIDER BAR */}
            <div className="w-full h-[1.5px] bg-black my-4" />

            {/* STICKER ROW 5: MATRIX FOOTER PARAMETERS & VECTOR BARCODE DECORATION */}
            <div className="flex items-end justify-between gap-3 text-[9px] leading-relaxed">
              <div className="space-y-1">
                <div>
                  <span className="font-extrabold text-slate-450 uppercase block">Packaging Date:</span>
                  <span className="font-black text-black text-[10.5px] font-mono">{creationDate}</span>
                </div>
                <div>
                  <span className="font-extrabold text-slate-450 uppercase block">Packaging Operator:</span>
                  <span className="font-black text-black text-[10.5px] uppercase">{assignedOperator}</span>
                </div>
                <div>
                  <span className="font-extrabold text-slate-450 uppercase block">Batch Serial No:</span>
                  <span className="font-black text-black text-[10.5px] font-mono tracking-tight">{serialCode}</span>
                </div>
              </div>

              {/* Highly realistic simulated SVG 1D Barcode with line rhythm and branding below it */}
              <div className="flex flex-col items-center gap-1.5 shrink-0" id="sticker-barcode">
                <svg className="w-24 h-8" viewBox="0 0 100 30" xmlns="http://www.w3.org/2000/svg">
                  {/* Generate varying bar widths dynamically */}
                  <rect x="0" y="0" width="3" height="30" fill="black" />
                  <rect x="4" y="0" width="1" height="30" fill="black" />
                  <rect x="7" y="0" width="2" height="30" fill="black" />
                  <rect x="11" y="0" width="4" height="30" fill="black" />
                  <rect x="17" y="0" width="1" height="30" fill="black" />
                  <rect x="19" y="0" width="3" height="30" fill="black" />
                  <rect x="24" y="0" width="2" height="30" fill="black" />
                  <rect x="28" y="0" width="1" height="30" fill="black" />
                  <rect x="30" y="0" width="4" height="30" fill="black" />
                  <rect x="36" y="0" width="2" height="30" fill="black" />
                  <rect x="40" y="0" width="1" height="30" fill="black" />
                  <rect x="43" y="0" width="3" height="30" fill="black" />
                  <rect x="48" y="0" width="1" height="30" fill="black" />
                  <rect x="51" y="0" width="4" height="30" fill="black" />
                  <rect x="57" y="0" width="2" height="30" fill="black" />
                  <rect x="61" y="0" width="1" height="30" fill="black" />
                  <rect x="64" y="0" width="3" height="30" fill="black" />
                  <rect x="69" y="0" width="2" height="30" fill="black" />
                  <rect x="73" y="0" width="1" height="30" fill="black" />
                  <rect x="76" y="0" width="4" height="30" fill="black" />
                  <rect x="82" y="0" width="1" height="30" fill="black" />
                  <rect x="85" y="0" width="3" height="30" fill="black" />
                  <rect x="90" y="0" width="2" height="30" fill="black" />
                  <rect x="94" y="0" width="1" height="30" fill="black" />
                  <rect x="97" y="0" width="3" height="30" fill="black" />
                </svg>
                <span className="text-[7.5px] font-black font-mono tracking-widest text-[#000000] uppercase block">
                  EPP SYSTEM
                </span>
              </div>
            </div>

          </div>

          {/* Quick inline help removed */}

        </div>

      </div>

    </div>
  );
}
