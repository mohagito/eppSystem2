import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { UserProfile, ProductionPlan, AirbagModel, MachineType, ShiftType } from '../types';
import { AIRBAG_MODELS, MOCK_PROFILES } from '../data';
import {
  CalendarRange,
  Cpu,
  Clock,
  Briefcase,
  AlertCircle,
  CheckCircle2,
  ListFilter,
  Plus,
  UserCheck,
  ClipboardList,
  Flame,
  Wrench,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Pencil
} from 'lucide-react';

interface PlanningProps {
  currentUser: UserProfile;
  plans: ProductionPlan[];
  dailyTargets: Record<string, number>;
  onUpdateDailyTarget: (dateStr: string, targetValue: number) => void;
  onAddPlan: (plan: Omit<ProductionPlan, 'id' | 'createdAt' | 'status'>) => void;
  onUpdatePlanStatus?: (id: string, status: 'Pending' | 'Completed' | 'Delayed') => void;
  onDeletePlan?: (id: string) => void;
  onEditPlan?: (id: string, updatedPlan: Partial<Omit<ProductionPlan, 'id' | 'createdAt'>>) => void;
}

export default function PlanningModule({
  currentUser,
  plans,
  dailyTargets,
  onUpdateDailyTarget,
  onAddPlan,
  onUpdatePlanStatus,
  onDeletePlan,
  onEditPlan
}: PlanningProps) {
  const formatLocalDate = (d: Date) => {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  // Plan Creator Form State
  const [selectedModel, setSelectedModel] = useState<AirbagModel>('BCB');
  const [planDate, setPlanDate] = useState<string>(formatLocalDate(new Date()));
  const [machine, setMachine] = useState<MachineType>('Big Machine');
  const [shift, setShift] = useState<ShiftType>('Morning');
  const [qtyPlanned, setQtyPlanned] = useState<string>('');
  const [assignedWorker, setAssignedWorker] = useState<string>(MOCK_PROFILES[1].name); // Default first worker
  const [notes, setNotes] = useState<string>('');
  const [formError, setFormError] = useState<string>('');

  // Edit Plan Modal state
  const [editingPlan, setEditingPlan] = useState<ProductionPlan | null>(null);
  const [editPlanDate, setEditPlanDate] = useState<string>('');
  const [editModel, setEditModel] = useState<AirbagModel>('BCB');
  const [editMachine, setEditMachine] = useState<MachineType>('Big Machine');
  const [editShift, setEditShift] = useState<ShiftType>('Morning');
  const [editQtyPlanned, setEditQtyPlanned] = useState<string>('');
  const [editAssignedWorker, setEditAssignedWorker] = useState<string>('');
  const [editNotes, setEditNotes] = useState<string>('');
  const [editStatus, setEditStatus] = useState<'Pending' | 'Completed' | 'Delayed'>('Pending');
  const [editFormError, setEditFormError] = useState<string>('');

  const handleStartEdit = (plan: ProductionPlan) => {
    setEditingPlan(plan);
    setEditPlanDate(plan.planDate);
    setEditModel(plan.model);
    setEditMachine(plan.machine);
    setEditShift(plan.shift);
    setEditQtyPlanned(plan.quantityPlanned.toString());
    setEditAssignedWorker(plan.assignedWorker);
    setEditNotes(plan.notes || '');
    setEditStatus(plan.status);
    setEditFormError('');
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setEditFormError('');

    const parsedQty = parseInt(editQtyPlanned, 10);
    if (!parsedQty || parsedQty <= 0) {
      setEditFormError('Please input a valid planned quantity greater than zero.');
      return;
    }

    if (!editPlanDate) {
      setEditFormError('Planning date is required.');
      return;
    }

    if (editingPlan && onEditPlan) {
      onEditPlan(editingPlan.id, {
        planDate: editPlanDate,
        machine: editMachine,
        shift: editShift,
        model: editModel,
        quantityPlanned: parsedQty,
        assignedWorker: editAssignedWorker,
        notes: editNotes.trim(),
        status: editStatus
      });
      setEditingPlan(null);
    }
  };

  // Weekly Matrix Schedule Navigation
  const [weekBaseDate, setWeekBaseDate] = useState<string>(() => {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }); // Default to actual today's local date

  const weekDays = useMemo(() => {
    const baseDate = new Date(weekBaseDate);
    const day = baseDate.getDay();
    // Monday is index 1. Sunday is index 0.
    const diff = baseDate.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(baseDate.setDate(diff));
    
    const days = [];
    const dayNames = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];
    const dayLabels = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    
    for (let i = 0; i < 7; i++) {
      const current = new Date(monday);
      current.setDate(monday.getDate() + i);
      const yyyy = current.getFullYear();
      const mm = String(current.getMonth() + 1).padStart(2, '0');
      const dd = String(current.getDate()).padStart(2, '0');
      const formattedDate = `${yyyy}-${mm}-${dd}`;
      const displayDate = `${dd}/${mm}/${yyyy}`;
      
      days.push({
        dateStr: formattedDate,
        displayDate,
        spanishName: dayNames[i],
        englishName: dayLabels[i]
      });
    }
    return days;
  }, [weekBaseDate]);

  const handlePrevWeek = () => {
    const date = new Date(weekBaseDate);
    date.setDate(date.getDate() - 7);
    setWeekBaseDate(formatLocalDate(date));
  };

  const handleNextWeek = () => {
    const date = new Date(weekBaseDate);
    date.setDate(date.getDate() + 7);
    setWeekBaseDate(formatLocalDate(date));
  };

  const handleCurrentWeek = () => {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    setWeekBaseDate(`${yyyy}-${mm}-${dd}`);
  };

  // Filtering State
  const [filterDateGroup, setFilterDateGroup] = useState<'all' | 'today' | 'upcoming'>('all');
  const [filterWorker, setFilterWorker] = useState<string>('ALL');

  const todayStr = useMemo(() => formatLocalDate(new Date()), []);

  // Filter implementation
  const filteredPlans = useMemo(() => {
    return [...plans]
      .sort((a, b) => a.planDate.localeCompare(b.planDate))
      .filter((plan) => {
        const isToday = plan.planDate === todayStr;
        const isUpcoming = plan.planDate > todayStr;

        const dateMatch =
          filterDateGroup === 'all' ||
          (filterDateGroup === 'today' && isToday) ||
          (filterDateGroup === 'upcoming' && isUpcoming);

        const workerMatch = filterWorker === 'ALL' || plan.assignedWorker === filterWorker;

        return dateMatch && workerMatch;
      });
  }, [plans, filterDateGroup, filterWorker, todayStr]);

  const workers = useMemo(() => MOCK_PROFILES.filter((p) => p.role === 'worker'), []);

  const assignedWorkerPlans = useMemo(() => {
    return plans.filter((p) => p.assignedWorker === currentUser.name);
  }, [plans, currentUser.name]);

  const handlePlanSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    const parsedQty = parseInt(qtyPlanned, 10);
    if (!parsedQty || parsedQty <= 0) {
      setFormError('Please input a valid planned quantity greater than zero.');
      return;
    }

    if (!planDate) {
      setFormError('Planning date is required.');
      return;
    }

    onAddPlan({
      planDate,
      machine,
      shift,
      model: selectedModel,
      quantityPlanned: parsedQty,
      assignedWorker,
      notes: notes.trim() || undefined,
      createdBy: currentUser.id
    });

    // Reset inputs
    setQtyPlanned('');
    setNotes('');
  };

  const getCellPlans = (machine: MachineType, shift: ShiftType, dateStr: string) => {
    return plans.filter(
      (p) => p.planDate === dateStr && p.machine === machine && p.shift === shift
    );
  };

  const getModelPillStyles = (model: AirbagModel) => {
    switch (model) {
      case 'TETOUAN':
        return 'bg-emerald-50 border-emerald-250 text-emerald-800 font-mono font-bold';
      case 'KUGA LHD':
      case 'KUGA RHD':
        return 'bg-sky-50 border-sky-205 text-sky-800 font-mono font-bold';
      case 'CRAFTER':
        return 'bg-amber-50 border-amber-205 text-amber-800 font-mono font-bold';
      case 'CADDY':
        return 'bg-indigo-50 border-indigo-205 text-indigo-800 font-mono font-bold';
      case 'BCB':
        return 'bg-purple-50 border-purple-205 text-purple-800 font-mono font-bold';
      default:
        return 'bg-slate-50 border-slate-200 text-slate-800 font-mono font-bold';
    }
  };

  const renderCellContent = (cellPlans: ProductionPlan[]) => {
    if (cellPlans.length === 0) {
      return (
        <div className="flex items-center justify-center h-full py-5 text-slate-350 select-none font-mono">
          —
        </div>
      );
    }

    return (
      <div className="space-y-1.5">
        {cellPlans.map((plan) => {
          const isYourJob = plan.assignedWorker === currentUser.name;
          return (
            <div
              key={plan.id}
              className={`p-1.5 rounded-lg border text-left transition-all ${
                isYourJob
                  ? 'bg-teal-50/90 border-teal-300 ring-2 ring-teal-400/10 shadow-2xs'
                  : 'bg-slate-50/60 border-slate-200 hover:border-slate-300'
              }`}
              title={`Operator: ${plan.assignedWorker}\nNotes: ${plan.notes || 'None'}`}
            >
              <div className="flex items-center justify-between gap-1">
                <span className={`text-[10px] font-extrabold px-1.5 py-0.2 rounded border uppercase ${getModelPillStyles(plan.model)}`}>
                  {plan.model.toLowerCase()}
                </span>
                <div className="flex items-center gap-1 shrink-0">
                  <span className={`text-[9px] font-extrabold ${
                    plan.status === 'Completed'
                      ? 'text-emerald-700'
                      : plan.status === 'Delayed'
                      ? 'text-amber-700'
                      : 'text-sky-700'
                  }`}>
                    {plan.status === 'Completed' ? '✓' : plan.status === 'Delayed' ? '⚠️' : '🕒'}
                  </span>
                  {currentUser.role === 'manager' && onEditPlan && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleStartEdit(plan);
                      }}
                      className="text-slate-400 hover:text-emerald-650 hover:bg-emerald-50 p-0.5 rounded-md transition-all shrink-0 cursor-pointer"
                      title="Edit this schedule target"
                    >
                      <Pencil size={10} strokeWidth={2.5} />
                    </button>
                  )}
                  {currentUser.role === 'manager' && onDeletePlan && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeletePlan(plan.id);
                      }}
                      className="text-slate-400 hover:text-rose-650 hover:bg-rose-50 p-0.5 rounded-md transition-all shrink-0 cursor-pointer"
                      title="Delete this schedule target"
                    >
                      <Plus size={10} className="rotate-45" strokeWidth={3} />
                    </button>
                  )}
                </div>
              </div>
              
              <div className="text-[10px] font-bold font-mono text-slate-800 mt-1 leading-tight flex items-baseline justify-between">
                <span>Progress: <span className="text-[11px] font-extrabold text-emerald-700">{plan.quantityCompleted || 0}</span><span className="text-slate-400">/{plan.quantityPlanned}</span></span>
                <span className="text-[8px] text-slate-400 font-sans font-semibold">pcs</span>
              </div>

              <div className="text-[9px] text-slate-500 font-sans font-semibold mt-1.5 flex items-center justify-between gap-1 border-t border-slate-100 pt-1">
                <span className="truncate max-w-[65px]" title={plan.assignedWorker}>
                  👤 {plan.assignedWorker.split(' ')[0]}
                </span>
                {isYourJob && (
                  <span className="text-[8px] text-teal-800 font-extrabold uppercase bg-teal-100 px-1 rounded animate-pulse shrink-0">
                    You
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="space-y-8" id="planning-module-view">
      {/* MASTER SCHEDULE SPREADSHEET MATRIX (EXCEL STYLE) */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-3xs overflow-hidden" id="weekly-schedule-excel-card">
        {/* EXCEL TITLE BAR & WEEK CONTROLS */}
        <div className="bg-slate-50 border-b border-slate-200 px-5 py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-slate-900 text-white rounded-lg text-xs font-mono font-bold select-none shadow-3xs">
              MTRX
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-slate-900 font-sans tracking-tight">
                  Weekly Production Layout Matrix
                </h3>
                <span className="px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-100 text-emerald-700 text-[9px] font-mono font-bold uppercase tracking-wider">
                  Live View
                </span>
              </div>
              <p className="text-[11px] text-slate-500 font-semibold font-sans mt-0.5">
                Hand-drawing register transformed into an interactive factory whiteboard. Grid cells display planned model shifts.
              </p>
            </div>
          </div>

          {/* WEEK CONTROLLER */}
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrevWeek}
              className="p-1 px-2.5 bg-white hover:bg-slate-100 border border-slate-205 text-slate-700 rounded-lg text-xs transition-all cursor-pointer font-bold flex items-center gap-1 shadow-3xs"
              title="Previous Week"
              id="excel-prev-week-btn"
            >
              <ChevronLeft size={14} />
              Prev
            </button>
            <button
              onClick={handleCurrentWeek}
              className="p-1 px-3 bg-white hover:bg-slate-100 border border-slate-150 text-slate-800 rounded-lg text-xs transition-all cursor-pointer font-extrabold shadow-3xs"
              id="excel-current-week-btn"
            >
              Today
            </button>
            <button
              onClick={handleNextWeek}
              className="p-1 px-2.5 bg-white hover:bg-slate-100 border border-slate-205 text-slate-700 rounded-lg text-xs transition-all cursor-pointer font-bold flex items-center gap-1 shadow-3xs"
              title="Next Week"
              id="excel-next-week-btn"
            >
              Next
              <ChevronRight size={14} />
            </button>
          </div>
        </div>

        {/* ACTIVE FORMULA INPUT FIELD EXCEL STYLING */}
        <div className="bg-white border-b border-slate-150 px-4 py-1.5 flex items-center gap-2 text-xs font-mono text-slate-600 select-none bg-slate-50/10">
          <span className="font-bold text-slate-400 italic">fx</span>
          <div className="w-[1px] h-3.5 bg-slate-200"></div>
          <span className="text-emerald-700 font-semibold">
            {`=WORK_WEEK(${new Date(weekDays[0].dateStr + 'T12:00:00').toLocaleDateString('es-ES', { month: '2-digit', day: '2-digit' })} - ${new Date(weekDays[6].dateStr + 'T12:00:00').toLocaleDateString('es-ES', { month: '2-digit', day: '2-digit', year: 'numeric' })})`}
          </span>
        </div>

        {/* EXCEL TABLE ENGINE */}
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full text-left border-collapse min-w-[950px]">
            <thead>
              <tr className="bg-slate-100 border-b border-slate-200">
                <th className="w-12 bg-slate-150/40 text-[10px] text-slate-400 font-mono font-bold text-center border-r border-slate-200 py-1.5 select-none">
                  #
                </th>
                <th className="w-40 bg-slate-150/40 text-[10px] text-slate-600 font-mono font-bold text-center border-r border-slate-200 px-3 uppercase tracking-wider">
                  MÁQUINA
                </th>
                <th className="w-40 bg-slate-150/40 text-[10px] text-slate-600 font-mono font-bold text-center border-r border-slate-200 px-3 uppercase tracking-wider">
                  SHIFT
                </th>
                {weekDays.map((day, idx) => {
                  const isToday = day.dateStr === todayStr;
                  return (
                    <th
                      key={day.dateStr}
                      className={`text-center border-r border-slate-200 py-2.5 px-2 select-none transition-all ${
                        isToday
                          ? 'bg-emerald-50/70 border-b-2 border-b-emerald-500 font-extrabold shadow-3xs'
                          : 'bg-slate-50'
                      }`}
                    >
                      <div className="text-[9px] text-slate-400 uppercase tracking-widest font-mono font-bold flex items-center justify-center gap-1">
                        <span>{idx === 0 ? 'A' : String.fromCharCode(65 + idx)}</span>
                        {isToday && (
                          <span className="bg-emerald-600 text-white text-[8px] font-sans font-extrabold px-1 py-0.2 rounded transform scale-90 leading-none">
                            HOY
                          </span>
                        )}
                      </div>
                      <div className={`text-xs font-extrabold capitalize font-sans leading-tight ${isToday ? 'text-emerald-950 font-black' : 'text-slate-800'}`}>
                        {day.spanishName}
                      </div>
                      <div className={`text-[9px] font-mono mt-0.5 ${isToday ? 'text-emerald-700 font-bold' : 'text-slate-400 font-semibold'}`}>
                        {day.displayDate}
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-xs text-slate-700">
              {/* Row 1: Pequeña (Small) - Morning */}
              <tr className="hover:bg-slate-50/20 bg-white">
                <td className="bg-slate-100/50 text-center font-mono font-bold text-slate-400 border-r border-slate-200 select-none py-4">
                  1
                </td>
                <td className="p-3 border-r border-slate-200 font-extrabold text-slate-850 align-top shrink-0 bg-slate-50/5">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded bg-teal-500 shrink-0"></span>
                    <div>
                      <div className="text-[11px] font-extrabold text-teal-850 uppercase tracking-wide">Pequeña</div>
                      <div className="text-[9px] text-slate-400 font-normal">Small Machine</div>
                    </div>
                  </div>
                </td>
                <td className="p-3 border-r border-slate-200 font-extrabold text-slate-700 align-top bg-slate-50/5">
                  <div className="flex items-center gap-1 text-[11px] text-emerald-800 font-semibold">
                    <span className="text-base leading-none">🌅</span>
                    <span>Morning (Mañana)</span>
                  </div>
                </td>
                {weekDays.map((day) => {
                  const cellPlans = getCellPlans('Small Machine', 'Morning', day.dateStr);
                  const isToday = day.dateStr === todayStr;
                  return (
                    <td
                      key={day.dateStr}
                      className={`p-2 border-r border-slate-205 align-top min-h-[90px] w-[11.5%] transition-all ${
                        cellPlans.some(p => p.assignedWorker === currentUser.name)
                          ? 'bg-teal-50/30'
                          : isToday
                          ? 'bg-emerald-50/15'
                          : ''
                      }`}
                    >
                      {renderCellContent(cellPlans)}
                    </td>
                  );
                })}
              </tr>

              {/* Row 2: Pequeña (Small) - Evening */}
              <tr className="hover:bg-slate-50/20 bg-white">
                <td className="bg-slate-100/50 text-center font-mono font-bold text-slate-400 border-r border-slate-200 select-none py-4">
                  2
                </td>
                <td className="p-3 border-r border-slate-200 font-extrabold text-slate-850 align-top shrink-0 bg-slate-50/5">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded bg-teal-500 shrink-0"></span>
                    <div>
                      <div className="text-[11px] font-extrabold text-teal-850 uppercase tracking-wide">Pequeña</div>
                      <div className="text-[9px] text-slate-400 font-normal">Small Machine</div>
                    </div>
                  </div>
                </td>
                <td className="p-3 border-r border-slate-200 font-extrabold text-slate-700 align-top bg-slate-50/5">
                  <div className="flex items-center gap-1 text-[11px] text-indigo-750 font-semibold">
                    <span className="text-base leading-none">🌆</span>
                    <span>Evening (Tarde)</span>
                  </div>
                </td>
                {weekDays.map((day) => {
                  const cellPlans = getCellPlans('Small Machine', 'Evening', day.dateStr);
                  const isToday = day.dateStr === todayStr;
                  return (
                    <td
                      key={day.dateStr}
                      className={`p-2 border-r border-slate-205 align-top min-h-[90px] w-[11.5%] transition-all ${
                        cellPlans.some(p => p.assignedWorker === currentUser.name)
                          ? 'bg-teal-50/30'
                          : isToday
                          ? 'bg-emerald-50/15'
                          : ''
                      }`}
                    >
                      {renderCellContent(cellPlans)}
                    </td>
                  );
                })}
              </tr>

              {/* Row 3: Grande (Big) - Morning */}
              <tr className="hover:bg-slate-50/20 bg-white">
                <td className="bg-slate-100/50 text-center font-mono font-bold text-slate-400 border-r border-slate-200 select-none py-4">
                  3
                </td>
                <td className="p-3 border-r border-slate-200 font-extrabold text-slate-850 align-top shrink-0 bg-slate-50/5">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded bg-indigo-65 shrink-0"></span>
                    <div>
                      <div className="text-[11px] font-extrabold text-indigo-850 uppercase tracking-wide">Grande</div>
                      <div className="text-[9px] text-slate-400 font-normal">Big Machine</div>
                    </div>
                  </div>
                </td>
                <td className="p-3 border-r border-slate-200 font-extrabold text-slate-700 align-top bg-slate-50/5">
                  <div className="flex items-center gap-1 text-[11px] text-emerald-800 font-semibold">
                    <span className="text-base leading-none">🌅</span>
                    <span>Morning (Mañana)</span>
                  </div>
                </td>
                {weekDays.map((day) => {
                  const cellPlans = getCellPlans('Big Machine', 'Morning', day.dateStr);
                  const isToday = day.dateStr === todayStr;
                  return (
                    <td
                      key={day.dateStr}
                      className={`p-2 border-r border-slate-205 align-top min-h-[90px] w-[11.5%] transition-all ${
                        cellPlans.some(p => p.assignedWorker === currentUser.name)
                          ? 'bg-teal-50/30'
                          : isToday
                          ? 'bg-emerald-50/15'
                          : ''
                      }`}
                    >
                      {renderCellContent(cellPlans)}
                    </td>
                  );
                })}
              </tr>

              {/* Row 4: Grande (Big) - Evening */}
              <tr className="hover:bg-slate-50/20 bg-white">
                <td className="bg-slate-100/50 text-center font-mono font-bold text-slate-400 border-r border-slate-200 select-none py-4">
                  4
                </td>
                <td className="p-3 border-r border-slate-200 font-extrabold text-slate-850 align-top shrink-0 bg-slate-50/5">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded bg-indigo-65 shrink-0"></span>
                    <div>
                      <div className="text-[11px] font-extrabold text-indigo-850 uppercase tracking-wide">Grande</div>
                      <div className="text-[9px] text-slate-400 font-normal">Big Machine</div>
                    </div>
                  </div>
                </td>
                <td className="p-3 border-r border-slate-200 font-extrabold text-slate-700 align-top bg-slate-50/5">
                  <div className="flex items-center gap-1 text-[11px] text-indigo-755 font-semibold">
                    <span className="text-base leading-none">🌆</span>
                    <span>Evening (Tarde)</span>
                  </div>
                </td>
                {weekDays.map((day) => {
                  const cellPlans = getCellPlans('Big Machine', 'Evening', day.dateStr);
                  const isToday = day.dateStr === todayStr;
                  return (
                    <td
                      key={day.dateStr}
                      className={`p-2 border-r border-slate-205 align-top min-h-[90px] w-[11.5%] transition-all ${
                        cellPlans.some(p => p.assignedWorker === currentUser.name)
                          ? 'bg-teal-50/30'
                          : isToday
                          ? 'bg-emerald-50/15'
                          : ''
                      }`}
                    >
                      {renderCellContent(cellPlans)}
                    </td>
                  );
                })}
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {currentUser.role === 'manager' && (
        <div className="max-w-xl mx-auto bg-white border border-slate-200 rounded-2xl p-6 shadow-3xs space-y-5" id="plan-creator-container">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-emerald-50 rounded-xl text-emerald-600 border border-emerald-100">
              <ClipboardList size={20} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Create Production Plan</h3>
              <p className="text-xs text-slate-500 font-semibold">Schedule factory outputs</p>
            </div>
          </div>

          {formError && (
            <div className="p-3 bg-rose-50 border border-rose-150 text-rose-705 rounded-xl text-xs font-semibold">
              {formError}
            </div>
          )}

          <form onSubmit={handlePlanSubmit} className="space-y-4" id="plan-creator-form">
            {/* Date select */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-500 tracking-wider uppercase">Target Production Date</label>
              <input
                type="date"
                value={planDate}
                onChange={(e) => setPlanDate(e.target.value)}
                className="w-full bg-slate-50/40 hover:bg-slate-50/90 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-800 font-mono focus:outline-hidden focus:bg-white focus:border-emerald-500 transition-all shadow-3xs"
                required
                id="plan-form-date"
              />
            </div>

            {/* Model dropdown */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-500 tracking-wider uppercase">Select Airbag Model</label>
              <div className="relative">
                <select
                  value={selectedModel}
                  onChange={(e) => setSelectedModel(e.target.value as AirbagModel)}
                  className="w-full bg-slate-50/40 hover:bg-slate-50/90 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 font-semibold focus:outline-hidden focus:bg-white focus:border-emerald-500 transition-all appearance-none cursor-pointer shadow-3xs"
                  id="plan-form-model"
                >
                  {AIRBAG_MODELS.map((model) => (
                    <option key={model} value={model}>
                      {model}
                    </option>
                  ))}
                </select>
                <ChevronDown size={14} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              </div>
            </div>

            {/* Machine and Shift Row */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-500 tracking-wider uppercase">Work Center</label>
                <div className="relative">
                  <select
                    value={machine}
                    onChange={(e) => setMachine(e.target.value as MachineType)}
                    className="w-full bg-slate-50/40 hover:bg-slate-50/90 border border-slate-200 rounded-xl px-2.5 py-2 text-xs text-slate-800 font-semibold focus:outline-hidden focus:bg-white focus:border-emerald-500 transition-all appearance-none cursor-pointer shadow-3xs"
                    id="plan-form-machine"
                  >
                    <option value="Big Machine">Big Machine</option>
                    <option value="Small Machine">Small Machine</option>
                  </select>
                  <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-500 tracking-wider uppercase">Shift Code</label>
                <div className="relative">
                  <select
                    value={shift}
                    onChange={(e) => setShift(e.target.value as ShiftType)}
                    className="w-full bg-slate-50/40 hover:bg-slate-50/90 border border-slate-200 rounded-xl px-2.5 py-2 text-xs text-slate-800 font-semibold focus:outline-hidden focus:bg-white focus:border-emerald-500 transition-all appearance-none cursor-pointer shadow-3xs"
                    id="plan-form-shift"
                  >
                    <option value="Morning">Morning (AM)</option>
                    <option value="Evening">Evening (PM)</option>
                  </select>
                  <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                </div>
              </div>
            </div>

            {/* Planned Quantity */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-500 tracking-wider uppercase">Planned Quantity (pcs)</label>
              <input
                type="number"
                placeholder="e.g. 150"
                value={qtyPlanned}
                onChange={(e) => setQtyPlanned(e.target.value)}
                className="w-full bg-slate-50/40 hover:bg-slate-50/95 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-800 font-mono focus:outline-hidden focus:bg-white focus:border-emerald-500 transition-colors shadow-3xs"
                min="1"
                required
                id="plan-form-quantity"
              />
            </div>

            {/* Assigned worker */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-500 tracking-wider uppercase">Assigned Operator</label>
              <div className="relative">
                <select
                  value={assignedWorker}
                  onChange={(e) => setAssignedWorker(e.target.value)}
                  className="w-full bg-slate-50/40 hover:bg-slate-50/90 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 font-semibold focus:outline-hidden focus:bg-white focus:border-emerald-500 transition-all appearance-none cursor-pointer shadow-3xs"
                  id="plan-form-worker"
                >
                  {workers.map((worker) => (
                    <option key={worker.id} value={worker.name}>
                      {worker.name} ({worker.station?.split(' ')[0] || 'Operator'})
                    </option>
                  ))}
                </select>
                <ChevronDown size={14} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-450 pointer-events-none" />
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-500 tracking-wider uppercase">Production Directives (Notes)</label>
              <textarea
                placeholder="Provide specific notes/tolerances/setup requests..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full bg-slate-50/40 hover:bg-slate-50/95 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-800 focus:outline-hidden focus:bg-white focus:border-emerald-500 transition-all shadow-3xs min-h-[70px] resize-none placeholder-slate-400"
                id="plan-form-notes"
              />
            </div>

            <button
              type="submit"
              className="w-full bg-slate-900 hover:bg-slate-800 text-white font-semibold py-2.5 rounded-xl text-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5 shadow-xs"
              id="submit-plan-button"
            >
              <Plus size={15} />
              Authorize Schedule
            </button>
          </form>
        </div>
      )}

      {/* EDIT PLANNING TARGET DIALOG */}
      <AnimatePresence>
        {editingPlan && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4" id="edit-plan-modal">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xl w-full max-w-md space-y-5"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-emerald-50 rounded-xl text-emerald-600 border border-emerald-100">
                    <Pencil size={18} />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Edit Production Plan</h3>
                    <p className="text-xs text-slate-500 font-semibold">Modify schedule specifications</p>
                  </div>
                </div>
                <button
                  onClick={() => setEditingPlan(null)}
                  className="text-slate-450 hover:text-slate-700 hover:bg-slate-100 p-1.5 rounded-lg transition-all cursor-pointer"
                >
                  <Plus size={16} className="rotate-45" strokeWidth={2.5} id="close-edit-modal-btn" />
                </button>
              </div>

              {editFormError && (
                <div className="p-3 bg-rose-50 border border-rose-150 text-rose-705 rounded-xl text-xs font-semibold">
                  {editFormError}
                </div>
              )}

              <form onSubmit={handleEditSubmit} className="space-y-4">
                {/* Date select */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 tracking-wider uppercase">Target Production Date</label>
                  <input
                    type="date"
                    value={editPlanDate}
                    onChange={(e) => setEditPlanDate(e.target.value)}
                    className="w-full bg-slate-50/40 hover:bg-slate-50/90 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-800 font-mono focus:outline-hidden focus:bg-white focus:border-emerald-500 transition-all shadow-3xs"
                    required
                  />
                </div>

                {/* Model dropdown */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 tracking-wider uppercase">Select Airbag Model</label>
                  <div className="relative">
                    <select
                      value={editModel}
                      onChange={(e) => setEditModel(e.target.value as AirbagModel)}
                      className="w-full bg-slate-50/40 hover:bg-slate-50/90 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 font-semibold focus:outline-hidden focus:bg-white focus:border-emerald-500 transition-all appearance-none cursor-pointer shadow-3xs"
                    >
                      {AIRBAG_MODELS.map((model) => (
                        <option key={model} value={model}>
                          {model}
                        </option>
                      ))}
                    </select>
                    <ChevronDown size={14} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  </div>
                </div>

                {/* Machine and Shift Row */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-500 tracking-wider uppercase">Work Center</label>
                    <div className="relative">
                      <select
                        value={editMachine}
                        onChange={(e) => setEditMachine(e.target.value as MachineType)}
                        className="w-full bg-slate-50/40 hover:bg-slate-50/90 border border-slate-200 rounded-xl px-2.5 py-2 text-xs text-slate-800 font-semibold focus:outline-hidden focus:bg-white focus:border-emerald-500 transition-all appearance-none cursor-pointer shadow-3xs"
                      >
                        <option value="Big Machine font-semibold">Big Machine</option>
                        <option value="Small Machine font-semibold">Small Machine</option>
                      </select>
                      <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-500 tracking-wider uppercase">Shift Code</label>
                    <div className="relative">
                      <select
                        value={editShift}
                        onChange={(e) => setEditShift(e.target.value as ShiftType)}
                        className="w-full bg-slate-50/40 hover:bg-slate-50/90 border border-slate-200 rounded-xl px-2.5 py-2 text-xs text-slate-800 font-semibold focus:outline-hidden focus:bg-white focus:border-emerald-500 transition-all appearance-none cursor-pointer shadow-3xs"
                      >
                        <option value="Morning">Morning (AM)</option>
                        <option value="Evening">Evening (PM)</option>
                      </select>
                      <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    </div>
                  </div>
                </div>

                {/* Planned Quantity & Status Row */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-500 tracking-wider uppercase">Quantity (pcs)</label>
                    <input
                      type="number"
                      value={editQtyPlanned}
                      onChange={(e) => setEditQtyPlanned(e.target.value)}
                      className="w-full bg-slate-50/40 hover:bg-slate-50/95 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-800 font-mono focus:outline-hidden focus:bg-white focus:border-emerald-500 transition-colors shadow-3xs"
                      min="1"
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-500 tracking-wider uppercase">Plan Status</label>
                    <div className="relative">
                      <select
                        value={editStatus}
                        onChange={(e) => setEditStatus(e.target.value as any)}
                        className="w-full bg-slate-50/40 hover:bg-slate-50/90 border border-slate-200 rounded-xl px-2.5 py-2 text-xs text-slate-805 font-bold focus:outline-hidden focus:bg-white focus:border-emerald-500 transition-all appearance-none cursor-pointer shadow-3xs"
                      >
                        <option value="Pending">🕒 Pending</option>
                        <option value="Completed">✓ Completed</option>
                        <option value="Delayed">⚠️ Delayed</option>
                      </select>
                      <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    </div>
                  </div>
                </div>

                {/* Assigned worker */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 tracking-wider uppercase">Assigned Operator</label>
                  <div className="relative">
                    <select
                      value={editAssignedWorker}
                      onChange={(e) => setEditAssignedWorker(e.target.value)}
                      className="w-full bg-slate-50/40 hover:bg-slate-50/90 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 font-semibold focus:outline-hidden focus:bg-white focus:border-emerald-500 transition-all appearance-none cursor-pointer shadow-3xs"
                    >
                      {workers.map((worker) => (
                        <option key={worker.id} value={worker.name}>
                          {worker.name} ({worker.station?.split(' ')[0] || 'Operator'})
                        </option>
                      ))}
                    </select>
                    <ChevronDown size={14} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-450 pointer-events-none" />
                  </div>
                </div>

                {/* Notes */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 tracking-wider uppercase">Production Directives (Notes)</label>
                  <textarea
                    placeholder="Provide specific notes/tolerances/setup requests..."
                    value={editNotes}
                    onChange={(e) => setEditNotes(e.target.value)}
                    className="w-full bg-slate-50/40 hover:bg-slate-50/95 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-800 focus:outline-hidden focus:bg-white focus:border-emerald-500 transition-all shadow-3xs min-h-[70px] resize-none placeholder-slate-400"
                  />
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setEditingPlan(null)}
                    className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2.5 rounded-xl text-xs transition-colors cursor-pointer text-center"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 bg-slate-900 hover:bg-slate-800 text-white font-bold py-2.5 rounded-xl text-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5 shadow-xs"
                    id="save-edited-plan-btn"
                  >
                    Save Changes
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
