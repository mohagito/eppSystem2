import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Scroll, 
  Plus, 
  Trash2, 
  Check, 
  History, 
  Layers, 
  Barcode, 
  Calendar, 
  User, 
  Weight, 
  Hash, 
  AlertCircle, 
  CheckCircle2, 
  Archive,
  Scissors,
  FileText,
  Search,
  Pencil
} from 'lucide-react';
import { RollEntry, RollMaterial, UserProfile } from '../types';
import Swal from 'sweetalert2';

interface RollsModuleProps {
  currentUser: UserProfile;
  rolls: RollEntry[];
  onAddRoll: (roll: Omit<RollEntry, 'id'>) => void;
  onOpenRoll: (id: string, barcode: string) => void;
  onConsumeRoll: (id: string, consumedMeters: number, notes?: string) => void;
  onDeleteRoll: (id: string) => void;
  onUpdateRoll?: (id: string, updates: Partial<RollEntry>) => void;
}

const MATERIAL_OPTIONS: RollMaterial[] = ['White Huesker', 'Yellow Huesker', 'Delcotex India', 'Kuga'];

const getMaterialBrand = (material: RollMaterial) => {
  switch (material) {
    case 'White Huesker':
    case 'Yellow Huesker':
      return 'Huesker';
    case 'Delcotex India':
      return 'Delcotex';
    case 'Kuga':
      return 'Kuga';
    default:
      return 'Generic';
  }
};

const getCategoryColorStyles = (material: RollMaterial) => {
  switch (material) {
    case 'White Huesker':
      return {
        bg: 'bg-white border-slate-200 hover:border-slate-300',
        dot: 'bg-slate-400',
        text: 'text-slate-800',
        badge: 'bg-slate-100 text-slate-800 border-slate-200'
      };
    case 'Yellow Huesker':
      return {
        bg: 'bg-white border-slate-200 hover:border-amber-300',
        dot: 'bg-amber-500',
        text: 'text-slate-800',
        badge: 'bg-amber-50 text-amber-800 border-amber-100'
      };
    case 'Delcotex India':
      return {
        bg: 'bg-white border-slate-200 hover:border-sky-300',
        dot: 'bg-sky-500',
        text: 'text-slate-800',
        badge: 'bg-sky-50 text-sky-800 border-sky-100'
      };
    case 'Kuga':
      return {
        bg: 'bg-white border-slate-200 hover:border-rose-300',
        dot: 'bg-rose-500',
        text: 'text-slate-800',
        badge: 'bg-rose-50 text-rose-800 border-rose-100'
      };
    default:
      return {
        bg: 'bg-white border-slate-200 hover:border-slate-300',
        dot: 'bg-slate-400',
        text: 'text-slate-800',
        badge: 'bg-slate-100 text-slate-800 border-slate-200'
      };
  }
};

export default function RollsModule({
  currentUser,
  rolls,
  onAddRoll,
  onOpenRoll,
  onConsumeRoll,
  onDeleteRoll,
  onUpdateRoll
}: RollsModuleProps) {
  // Navigation inside the module
  const [subTab, setSubTab] = useState<'unopened' | 'active' | 'history'>('unopened');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Form States for Registering New Roll
  const [materialName, setMaterialName] = useState<RollMaterial>('White Huesker');
  const [initialStatus, setInitialStatus] = useState<'Unopened' | 'Active'>('Unopened');
  const [barcode, setBarcode] = useState<string>('');
  const [operator, setOperator] = useState<string>(currentUser.name);
  const [formOpen, setFormOpen] = useState<boolean>(false);

  // Auto Generate Barcode
  const handleAutoGenerateBarcode = () => {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const hh = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    const rand = Math.floor(100 + Math.random() * 900);
    
    // Clean material code for barcode compatibility (no spaces)
    const matCode = materialName.replace(/\s+/g, '').toUpperCase();
    const generated = `EPP-ROLL-${matCode}-${yyyy}${mm}${dd}-${hh}${min}${rand}`;
    setBarcode(generated);
  };

  const handleRegisterRoll = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (initialStatus === 'Active' && !barcode.trim()) {
      Swal.fire({
        title: 'Missing Barcode',
        text: 'Please input or generate a unique traceability barcode/serial number to open the roll immediately.',
        icon: 'warning',
        background: '#0f172a',
        color: '#cbd5e1',
        confirmButtonColor: '#10b981'
      });
      return;
    }

    const todayStr = new Date().toISOString().split('T')[0];

    onAddRoll({
      materialName,
      date: todayStr,
      barcode: barcode.trim() || undefined,
      operator: operator.trim(),
      createdBy: currentUser.id,
      status: initialStatus
    });

    // Reset Form
    setBarcode('');
    setFormOpen(false);

    Swal.fire({
      toast: true,
      position: 'top-end',
      icon: 'success',
      title: 'Roll Registered successfully',
      showConfirmButton: false,
      timer: 3000,
      background: '#0f172a',
      color: '#cbd5e1'
    });
  };

  // Mark Roll as fully consumed
  const triggerConsumeRollDialog = (roll: RollEntry) => {
    Swal.fire({
      title: 'Consume Fabric Roll',
      html: `
        <div class="text-left space-y-4 font-sans text-xs">
          <p class="text-slate-300">Are you marking <strong class="text-white">${roll.materialName}</strong> (${roll.barcode}) as fully consumed?</p>
          <div class="space-y-1.5">
            <label class="text-[10px] font-bold text-slate-400 tracking-wider uppercase font-mono">Total consumed length (meters)</label>
            <input id="swal-consumed-meters" type="number" class="w-full bg-slate-900 border border-slate-700 text-white p-2.5 rounded-lg text-xs" value="1000" min="0" />
          </div>
          <div class="space-y-1.5 mt-3">
            <label class="text-[10px] font-bold text-slate-400 tracking-wider uppercase font-mono">Optional Remarks / Notes</label>
            <textarea id="swal-consume-notes" class="w-full bg-slate-900 border border-slate-700 text-white p-2.5 rounded-lg text-xs h-16 resize-none" placeholder="Fully spent, minor fabric defects, etc."></textarea>
          </div>
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: 'Declare Spent',
      cancelButtonText: 'Cancel',
      background: '#0f172a',
      color: '#cbd5e1',
      confirmButtonColor: '#10b981',
      cancelButtonColor: '#334155',
      customClass: {
        popup: 'rounded-2xl border border-slate-800 shadow-2xl p-6 font-sans',
        title: 'text-sm font-extrabold uppercase tracking-wider text-slate-100 font-sans'
      },
      preConfirm: () => {
        const consumedInput = document.getElementById('swal-consumed-meters') as HTMLInputElement;
        const notesInput = document.getElementById('swal-consume-notes') as HTMLTextAreaElement;
        return {
          consumedMeters: parseFloat(consumedInput?.value || '1000') || 0,
          notes: notesInput?.value || ''
        };
      }
    }).then((result) => {
      if (result.isConfirmed) {
        const { consumedMeters, notes: consumeNotes } = result.value;
        onConsumeRoll(roll.id, consumedMeters, consumeNotes);
      }
    });
  };

  // Open Roll with Barcode assignment
  const triggerOpenRollDialog = (roll: RollEntry) => {
    // Generate a default barcode suggestion
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const hh = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    const rand = Math.floor(100 + Math.random() * 900);
    const matCode = roll.materialName.replace(/\s+/g, '').toUpperCase();
    const defaultBarcode = `EPP-ROLL-${matCode}-${yyyy}${mm}${dd}-${hh}${min}${rand}`;

    Swal.fire({
      title: 'Open Fabric Roll',
      html: `
        <div class="text-left space-y-4 font-sans text-xs">
          <p class="text-slate-300 font-medium">You are opening <strong class="text-indigo-400 font-extrabold">${roll.materialName}</strong> for production tracking.</p>
          <div class="space-y-1.5">
            <div class="flex items-center justify-between">
              <label class="text-[10px] font-bold text-slate-400 tracking-wider uppercase font-mono">Traceability Barcode / Serial No</label>
              <button type="button" id="swal-gen-btn" class="text-[9px] text-indigo-400 hover:text-indigo-300 uppercase tracking-wide font-extrabold cursor-pointer">
                [ Auto Generate ]
              </button>
            </div>
            <input id="swal-open-barcode" type="text" class="w-full bg-slate-900 border border-slate-700 text-white p-2.5 rounded-lg text-xs font-mono focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500" value="${roll.barcode || defaultBarcode}" placeholder="Type or scan barcode..." />
            <p class="text-[9px] text-slate-400 mt-1">Assign a physical barcode/serial label to link this roll to the digital trace.</p>
          </div>
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: 'Open & Activate',
      cancelButtonText: 'Cancel',
      background: '#0f172a',
      color: '#cbd5e1',
      confirmButtonColor: '#10b981',
      cancelButtonColor: '#334155',
      customClass: {
        popup: 'rounded-2xl border border-slate-800 shadow-2xl p-6 font-sans',
        title: 'text-sm font-extrabold uppercase tracking-wider text-slate-100 font-sans'
      },
      didOpen: () => {
        const genBtn = document.getElementById('swal-gen-btn');
        const barcodeInput = document.getElementById('swal-open-barcode') as HTMLInputElement;
        if (genBtn && barcodeInput) {
          genBtn.addEventListener('click', () => {
            const innerD = new Date();
            const innerY = innerD.getFullYear();
            const innerM = String(innerD.getMonth() + 1).padStart(2, '0');
            const innerDd = String(innerD.getDate()).padStart(2, '0');
            const innerH = String(innerD.getHours()).padStart(2, '0');
            const innerMin = String(innerD.getMinutes()).padStart(2, '0');
            const innerRand = Math.floor(100 + Math.random() * 900);
            barcodeInput.value = `EPP-ROLL-${matCode}-${innerY}${innerM}${innerDd}-${innerH}${innerMin}${innerRand}`;
          });
        }
      },
      preConfirm: () => {
        const barcodeInput = document.getElementById('swal-open-barcode') as HTMLInputElement;
        const bValue = barcodeInput?.value?.trim();
        if (!bValue) {
          Swal.showValidationMessage('A barcode is required to activate and trace this material roll.');
          return false;
        }
        return bValue;
      }
    }).then((result) => {
      if (result.isConfirmed && result.value) {
        onOpenRoll(roll.id, result.value);
      }
    });
  };

  // Edit Roll Record Dialog
  const triggerEditRollDialog = (roll: RollEntry) => {
    Swal.fire({
      title: 'Edit Material Roll Record',
      html: `
        <div class="text-left space-y-4 font-sans text-xs">
          <p class="text-slate-300 font-medium">Modify the registered parameters of this fabric roll record.</p>
          
          <div class="grid grid-cols-2 gap-3">
            <div class="space-y-1.5">
              <label class="text-[10px] font-bold text-slate-400 tracking-wider uppercase font-mono">Fabric Material</label>
              <select id="swal-edit-material" class="w-full bg-slate-900 border border-slate-700 text-white p-2.5 rounded-lg text-xs">
                ${MATERIAL_OPTIONS.map(opt => `<option value="${opt}" ${roll.materialName === opt ? 'selected' : ''}>${opt}</option>`).join('')}
              </select>
            </div>

            <div class="space-y-1.5">
              <label class="text-[10px] font-bold text-slate-400 tracking-wider uppercase font-mono">Status</label>
              <select id="swal-edit-status" class="w-full bg-slate-900 border border-slate-700 text-white p-2.5 rounded-lg text-xs">
                <option value="Unopened" ${roll.status === 'Unopened' ? 'selected' : ''}>📦 Unopened</option>
                <option value="Active" ${roll.status === 'Active' ? 'selected' : ''}>🧵 Active (Opened)</option>
                <option value="Consumed" ${roll.status === 'Consumed' ? 'selected' : ''}>✅ Consumed (Spent)</option>
              </select>
            </div>
          </div>

          <div class="space-y-1.5">
            <label class="text-[10px] font-bold text-slate-400 tracking-wider uppercase font-mono">Traceability Barcode / Serial No</label>
            <input id="swal-edit-barcode" type="text" class="w-full bg-slate-900 border border-slate-700 text-white p-2.5 rounded-lg text-xs font-mono" value="${roll.barcode || ''}" placeholder="Pending opening..." />
          </div>

          <div class="grid grid-cols-2 gap-3">
            <div class="space-y-1.5">
              <label class="text-[10px] font-bold text-slate-400 tracking-wider uppercase font-mono">Operator</label>
              <input id="swal-edit-operator" type="text" class="w-full bg-slate-900 border border-slate-700 text-white p-2.5 rounded-lg text-xs" value="${roll.operator}" />
            </div>

            <div class="space-y-1.5">
              <label class="text-[10px] font-bold text-slate-400 tracking-wider uppercase font-mono">Date Added</label>
              <input id="swal-edit-date" type="date" class="w-full bg-slate-900 border border-slate-700 text-white p-2.5 rounded-lg text-xs font-mono" value="${roll.date}" />
            </div>
          </div>

          <div id="swal-edit-consumed-container" class="space-y-1.5 ${roll.status === 'Consumed' ? '' : 'hidden'}">
            <label class="text-[10px] font-bold text-slate-400 tracking-wider uppercase font-mono">Consumed Length (meters)</label>
            <input id="swal-edit-consumed" type="number" class="w-full bg-slate-900 border border-slate-700 text-white p-2.5 rounded-lg text-xs font-mono" value="${roll.consumedMeters !== undefined ? roll.consumedMeters : 1000}" min="0" />
          </div>

          <div class="space-y-1.5">
            <label class="text-[10px] font-bold text-slate-400 tracking-wider uppercase font-mono">Notes / Remarks</label>
            <textarea id="swal-edit-notes" class="w-full bg-slate-900 border border-slate-700 text-white p-2.5 rounded-lg text-xs h-16 resize-none" placeholder="Enter notes here...">${roll.notes || ''}</textarea>
          </div>
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: 'Save Changes',
      cancelButtonText: 'Cancel',
      background: '#0f172a',
      color: '#cbd5e1',
      confirmButtonColor: '#10b981',
      cancelButtonColor: '#334155',
      customClass: {
        popup: 'rounded-2xl border border-slate-800 shadow-2xl p-6 font-sans',
        title: 'text-sm font-extrabold uppercase tracking-wider text-slate-100 font-sans'
      },
      didOpen: () => {
        const statusSelect = document.getElementById('swal-edit-status') as HTMLSelectElement;
        const consumedContainer = document.getElementById('swal-edit-consumed-container');
        if (statusSelect && consumedContainer) {
          statusSelect.addEventListener('change', (e) => {
            const val = (e.target as HTMLSelectElement).value;
            if (val === 'Consumed') {
              consumedContainer.classList.remove('hidden');
            } else {
              consumedContainer.classList.add('hidden');
            }
          });
        }
      },
      preConfirm: () => {
        const materialSelect = document.getElementById('swal-edit-material') as HTMLSelectElement;
        const statusSelect = document.getElementById('swal-edit-status') as HTMLSelectElement;
        const barcodeInput = document.getElementById('swal-edit-barcode') as HTMLInputElement;
        const operatorInput = document.getElementById('swal-edit-operator') as HTMLInputElement;
        const dateInput = document.getElementById('swal-edit-date') as HTMLInputElement;
        const consumedInput = document.getElementById('swal-edit-consumed') as HTMLInputElement;
        const notesInput = document.getElementById('swal-edit-notes') as HTMLTextAreaElement;

        const materialVal = materialSelect.value as RollMaterial;
        const statusVal = statusSelect.value as 'Unopened' | 'Active' | 'Consumed';
        const barcodeVal = barcodeInput.value.trim();
        const operatorVal = operatorInput.value.trim();
        const dateVal = dateInput.value;
        const consumedVal = parseFloat(consumedInput.value) || 0;
        const notesVal = notesInput.value.trim();

        if (!operatorVal) {
          Swal.showValidationMessage('An operator name is required.');
          return false;
        }

        if (statusVal !== 'Unopened' && !barcodeVal) {
          Swal.showValidationMessage('A barcode is required for Active/Consumed rolls.');
          return false;
        }

        return {
          materialName: materialVal,
          status: statusVal,
          barcode: barcodeVal || undefined,
          operator: operatorVal,
          date: dateVal,
          consumedMeters: statusVal === 'Consumed' ? consumedVal : undefined,
          notes: notesVal
        };
      }
    }).then((result) => {
      if (result.isConfirmed && result.value) {
        if (onUpdateRoll) {
          onUpdateRoll(roll.id, result.value);
        }
      }
    });
  };

  // Helper for computing counts of visible rolls under each status
  const visibleRollsCount = (status: 'Unopened' | 'Active' | 'Consumed') => {
    return rolls.filter(r => {
      if (currentUser.role === 'worker') {
        if (r.status === 'Unopened') {
          return r.status === status;
        }
        return (
          r.status === status &&
          ((r.operator || '').toLowerCase().trim() === currentUser.name.toLowerCase().trim() ||
            r.createdBy === currentUser.id)
        );
      }
      return r.status === status;
    }).length;
  };

  // Filter rolls based on status and search query
  const filteredRolls = rolls
    .filter(r => {
      if (currentUser.role === 'worker') {
        if (r.status === 'Unopened') {
          return true;
        }
        return (
          (r.operator || '').toLowerCase().trim() === currentUser.name.toLowerCase().trim() ||
          r.createdBy === currentUser.id
        );
      }
      return true;
    })
    .filter(r => {
      let matchesTab = false;
      if (subTab === 'unopened') {
        matchesTab = r.status === 'Unopened';
      } else if (subTab === 'active') {
        matchesTab = r.status === 'Active';
      } else {
        matchesTab = r.status === 'Consumed';
      }
      const matchesSearch = 
        r.materialName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (r.barcode || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (r.operator || '').toLowerCase().includes(searchQuery.toLowerCase());
      return matchesTab && matchesSearch;
    });

  // Calculate category stocks (Unopened, Active, Spent)
  const categoryStats = MATERIAL_OPTIONS.map(material => {
    const unopenedCount = rolls.filter(r => r.materialName === material && r.status === 'Unopened').length;
    const activeCount = rolls.filter(r => r.materialName === material && r.status === 'Active').length;
    const spentCount = rolls.filter(r => r.materialName === material && r.status === 'Consumed').length;
    return {
      material,
      unopened: unopenedCount,
      active: activeCount,
      spent: spentCount
    };
  });

  return (
    <div className="space-y-6" id="rolls-traceability-module">
      
      {/* Header Panel */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-white border border-slate-200 p-6 rounded-2xl shadow-xs" id="rolls-header-panel">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
            <Scroll size={22} className="animate-pulse" />
          </div>
          <div>
            <h1 className="text-xl font-extrabold text-slate-900 flex items-center gap-2">
              Material Rolls Traceability
            </h1>
            <p className="text-xs text-slate-500 font-semibold mt-0.5">
              Secure digital log for fabric coils & trace-back barcode tracking.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setFormOpen(!formOpen)}
            className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-2 cursor-pointer active:scale-95"
          >
            <Plus size={15} />
            {formOpen ? 'Hide Register Panel' : 'Register New Roll'}
          </button>
        </div>
      </div>

      {/* Form Area with slide effect */}
      <AnimatePresence>
        {formOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden mb-6"
          >
            <form 
              onSubmit={handleRegisterRoll}
              className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4"
              id="new-roll-form"
            >
              <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
                <Scroll size={16} className="text-indigo-600" />
                <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">
                  Register Material Roll
                </h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                
                {/* Material Dropdown */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 tracking-wider uppercase flex items-center gap-1.5">
                    <Layers size={12} className="text-slate-400" />
                    Fabric Material Name
                  </label>
                  <select
                    value={materialName}
                    onChange={(e) => setMaterialName(e.target.value as RollMaterial)}
                    className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-xs font-bold p-2.5 rounded-xl focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                  >
                    {MATERIAL_OPTIONS.map(opt => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                </div>

                {/* Storage / Use State */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 tracking-wider uppercase flex items-center gap-1.5">
                    <Archive size={12} className="text-slate-400" />
                    Storage / Use State
                  </label>
                  <select
                    value={initialStatus}
                    onChange={(e) => setInitialStatus(e.target.value as 'Unopened' | 'Active')}
                    className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-xs font-bold p-2.5 rounded-xl focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value="Unopened">📦 Unopened Stock (Reserve)</option>
                    <option value="Active">🧵 Active Production (Open Now)</option>
                  </select>
                </div>

                {/* Barcode Tracker input */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 tracking-wider uppercase flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <Barcode size={12} className="text-slate-400" />
                      Traceability Barcode {initialStatus === 'Unopened' ? <span className="text-[9px] text-amber-600 lowercase font-medium">(optional)</span> : <span className="text-[9px] text-red-500 lowercase font-medium">(required)</span>}
                    </span>
                    <button
                      type="button"
                      onClick={handleAutoGenerateBarcode}
                      className="text-[9px] text-indigo-600 hover:text-indigo-700 font-extrabold uppercase tracking-wide cursor-pointer focus:outline-hidden"
                    >
                      [ Auto Generate ]
                    </button>
                  </label>
                  <input
                    type="text"
                    value={barcode}
                    onChange={(e) => setBarcode(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-xs font-bold p-2.5 rounded-xl focus:outline-hidden focus:ring-1 focus:ring-indigo-500 font-mono"
                    placeholder={initialStatus === 'Unopened' ? "Leave blank or auto-generate" : "Type or click Auto Generate"}
                  />
                </div>

                {/* Operator Assigned */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 tracking-wider uppercase flex items-center gap-1.5">
                    <User size={12} className="text-slate-400" />
                    Registering Operator Name
                  </label>
                  <input
                    type="text"
                    value={operator}
                    onChange={(e) => setOperator(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-xs font-bold p-2.5 rounded-xl focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setFormOpen(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-xl text-xs font-bold transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer"
                >
                  {initialStatus === 'Unopened' ? 'Confirm & Save to Stock' : 'Confirm & Open Roll'}
                </button>
              </div>

            </form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Factory Reserve & Material Stock Status (Spreadsheet Style) */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden" id="material-stock-status-table-card">
        <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <h2 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
              <Layers size={14} className="text-indigo-600" />
              Factory Reserve Stock Status
            </h2>
            <p className="text-[10px] text-slate-500 font-medium mt-0.5">
              Live physical inventory count of unopened rolls available in the warehouse. Click any row to filter the detailed tracking list.
            </p>
          </div>
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="text-[9px] font-extrabold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-2 py-1 rounded-lg transition-all self-start sm:self-center"
            >
              Clear Filter
            </button>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse" id="material-stock-spreadsheet">
            <thead>
              <tr className="bg-[#f0c2bd]/20 border-b border-[#e9b4af] text-[10px] font-extrabold text-[#7f342d] uppercase tracking-wider">
                <th className="py-2.5 px-4 font-black">Material / Model</th>
                <th className="py-2.5 px-4 font-black">Brand / Client</th>
                <th className="py-2.5 px-4 text-center font-black">Total Stock Status</th>
                <th className="py-2.5 px-4 font-black">Notes / Alert</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {categoryStats
                .sort((a, b) => b.unopened - a.unopened) // Sort matching user's spreadsheet: 9, 7, 4, 0
                .map((stat) => {
                  const brand = getMaterialBrand(stat.material);
                  const isCurrentFilter = searchQuery.toLowerCase() === stat.material.toLowerCase();
                  
                  return (
                    <tr 
                      key={stat.material}
                      onClick={() => setSearchQuery(isCurrentFilter ? '' : stat.material)}
                      className={`hover:bg-slate-50/80 transition-all cursor-pointer group ${
                        isCurrentFilter ? 'bg-indigo-50/40' : ''
                      }`}
                    >
                      {/* Material Name */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full ${
                            stat.material === 'Yellow Huesker' ? 'bg-amber-400' :
                            stat.material === 'White Huesker' ? 'bg-slate-300' :
                            stat.material === 'Kuga' ? 'bg-rose-400' : 'bg-sky-400'
                          }`} />
                          <span className={`text-xs font-bold text-slate-800 group-hover:text-indigo-600 transition-colors ${
                            isCurrentFilter ? 'text-indigo-600 font-extrabold' : ''
                          }`}>
                            {stat.material}
                          </span>
                        </div>
                      </td>

                      {/* Brand / Client */}
                      <td className="py-3.5 px-4 text-xs font-semibold text-slate-500">
                        {brand}
                      </td>

                      {/* Total Stock Status */}
                      <td className="py-3.5 px-4 text-center">
                        <span className={`inline-flex items-center justify-center font-mono text-sm font-black w-8 h-8 rounded-full ${
                          stat.unopened === 0 
                            ? 'text-red-600 bg-red-50' 
                            : stat.unopened <= 3 
                            ? 'text-amber-600 bg-amber-50'
                            : 'text-slate-800 bg-slate-100'
                        }`}>
                          {stat.unopened}
                        </span>
                      </td>

                      {/* Notes / Alert */}
                      <td className="py-3.5 px-4 text-xs font-bold">
                        {stat.unopened === 0 ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-red-50 text-red-600 rounded-lg border border-red-100 text-[9px] uppercase tracking-wide">
                            <AlertCircle size={11} className="animate-pulse" />
                            ⚠️ Out of Stock
                          </span>
                        ) : stat.unopened <= 3 ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-50 text-amber-600 rounded-lg border border-amber-100 text-[9px] uppercase tracking-wide">
                            <AlertCircle size={11} />
                            Low Stock Alert
                          </span>
                        ) : (
                          <span className="text-slate-400 font-medium italic text-[10px]">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Main filter bar & tabs */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs space-y-4" id="rolls-main-list-card">
        
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-100 pb-3">
          
          {/* Tabs */}
          <div className="flex bg-slate-100 p-1 rounded-xl max-w-md shrink-0" id="rolls-sub-tabs">
            <button
              onClick={() => setSubTab('unopened')}
              className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                subTab === 'unopened'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Archive size={13} className={subTab === 'unopened' ? 'text-indigo-600' : ''} />
              Unopened Stock ({visibleRollsCount('Unopened')})
            </button>
            <button
              onClick={() => setSubTab('active')}
              className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                subTab === 'active'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <CheckCircle2 size={13} className={subTab === 'active' ? 'text-indigo-600' : ''} />
              Active ({visibleRollsCount('Active')})
            </button>
            <button
              onClick={() => setSubTab('history')}
              className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                subTab === 'history'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <History size={13} className={subTab === 'history' ? 'text-indigo-600' : ''} />
              Spent ({visibleRollsCount('Consumed')})
            </button>
          </div>

          {/* Search box */}
          <div className="relative flex-1 max-w-sm sm:ml-auto">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
              <Search size={14} />
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 text-slate-800 placeholder-slate-400 text-xs font-bold pl-9 pr-4 py-2.5 rounded-xl focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
              placeholder="Search by material, barcode or operator..."
            />
          </div>

        </div>

        {/* List of Roll records */}
        <div className="overflow-x-auto">
          {filteredRolls.length === 0 ? (
            <div className="py-12 text-center text-slate-400 space-y-2">
              <Archive size={36} className="mx-auto text-slate-300 animate-bounce" />
              <p className="text-xs font-bold">No traceability records matching filters.</p>
              <p className="text-[11px] text-slate-400">Register rolls above to start fabric tracking.</p>
            </div>
          ) : (
             <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  <th className="py-3 px-3">Fabric Material</th>
                  <th className="py-3 px-3">Barcode Serial No</th>
                  <th className="py-3 px-3">
                    {subTab === 'unopened' ? 'Date Added' : 'Opened On'}
                  </th>
                  <th className="py-3 px-3">Status</th>
                  {subTab === 'history' && (
                    <>
                      <th className="py-3 px-3">Closed On</th>
                      <th className="py-3 px-3">Consumed Meters</th>
                    </>
                  )}
                  <th className="py-3 px-3">Assigned Operator</th>
                  <th className="py-3 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filteredRolls.map((roll) => (
                  <tr key={roll.id} className="hover:bg-slate-50/50 transition-colors">
                    
                    {/* Material name */}
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 shrink-0" />
                        <span className="font-bold text-slate-800">{roll.materialName}</span>
                      </div>
                    </td>

                    {/* Barcode */}
                    <td className="py-3 px-3 font-mono text-[10.5px] font-bold text-slate-600">
                      {roll.barcode || (
                        <span className="text-slate-400 italic font-medium text-[10px] tracking-wide bg-slate-100/60 px-2 py-0.5 rounded-md">
                          Pending Opening
                        </span>
                      )}
                    </td>

                    {/* Date opened / Date Added */}
                    <td className="py-3 px-3 font-semibold text-slate-500 font-mono">
                      {roll.status === 'Unopened' 
                        ? roll.date 
                        : roll.openedAt 
                        ? new Date(roll.openedAt).toLocaleDateString() 
                        : roll.date
                      }
                    </td>

                    {/* Status Badge */}
                    <td className="py-3 px-3">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                        roll.status === 'Active'
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                          : roll.status === 'Unopened'
                          ? 'bg-indigo-50 text-indigo-700 border-indigo-100'
                          : 'bg-slate-50 text-slate-500 border-slate-100'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${
                          roll.status === 'Active' 
                            ? 'bg-emerald-500' 
                            : roll.status === 'Unopened'
                            ? 'bg-indigo-500'
                            : 'bg-slate-400'
                        }`} />
                        {roll.status}
                      </span>
                    </td>

                    {/* Spent metadata */}
                    {subTab === 'history' && (
                      <>
                        <td className="py-3 px-3 font-semibold text-slate-500 font-mono">
                          {roll.closedAt ? new Date(roll.closedAt).toLocaleDateString() : '-'}
                        </td>
                        <td className="py-3 px-3 font-bold text-slate-700 font-mono">
                          {roll.consumedMeters !== undefined ? `${roll.consumedMeters}m` : 'Spent'}
                        </td>
                      </>
                    )}

                    {/* Operator */}
                    <td className="py-3 px-3 font-bold text-slate-700">
                      <div className="flex items-center gap-1.5">
                        <div className="w-5 h-5 rounded-full bg-slate-200 text-[10px] flex items-center justify-center text-slate-600 font-black">
                          {roll.operator.substring(0, 1).toUpperCase()}
                        </div>
                        {roll.operator}
                      </div>
                    </td>

                    {/* Action buttons */}
                    <td className="py-3 px-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {roll.status === 'Unopened' ? (
                          <button
                            onClick={() => triggerOpenRollDialog(roll)}
                            className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[11px] font-black tracking-wide transition-all cursor-pointer active:scale-95 flex items-center gap-1"
                          >
                            <Plus size={11} /> Open Roll
                          </button>
                        ) : null}

                        {roll.status === 'Active' ? (
                          <button
                            onClick={() => triggerConsumeRollDialog(roll)}
                            className="px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-[11px] font-black tracking-wide transition-all cursor-pointer active:scale-95"
                          >
                            Mark Consumed
                          </button>
                        ) : null}

                        <button
                          onClick={() => triggerEditRollDialog(roll)}
                          className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all cursor-pointer"
                          title="Edit roll details"
                        >
                          <Pencil size={13} />
                        </button>

                        <button
                          onClick={() => onDeleteRoll(roll.id)}
                          className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all cursor-pointer"
                          title="Delete traceability log"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>

                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

      </div>

    </div>
  );
}
