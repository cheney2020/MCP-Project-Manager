import React, { useState, useEffect, useRef, useMemo } from 'react';
import { defaultState } from './defaultData';
import { AppState, McpToolTask, Priority, MeetingRecord, ConfirmItem, TextItem, BlockerItem, DecisionItem } from './types';
import { getDaysBetween, formatDate } from './utils';
import { AlertTriangle, RotateCcw, Clock, Calendar, Sparkles, Image as ImageIcon, Target } from 'lucide-react';
import * as htmlToImage from 'html-to-image';

const dataURLtoBlob = (dataUrl: string) => {
  try {
    const parts = dataUrl.split(',');
    const mime = parts[0].match(/:(.*?);/)?.[1] || '';
    const bstr = atob(parts[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    return new Blob([u8arr], { type: mime });
  } catch (e) {
    console.error('Failed to convert dataURL to Blob', e);
    return null;
  }
};

const createEmptyMeeting = (date: string): MeetingRecord => ({
  id: `m_${Date.now()}`,
  date,
  confirmations: [
    { id: `c1_${Date.now()}`, text: '服务列表 list_dataservice 的接口字段是否冻结', done: false },
    { id: `c2_${Date.now()}`, text: '服务元数据 describe_dataservice 是否覆盖字段、参数、指标、维度', done: false },
    { id: `c3_${Date.now()}`, text: '数据查询 query_dataservice 的参数结构是否确定', done: false },
    { id: `c4_${Date.now()}`, text: '统一接入 MCP 开关是否影响原有使用方式', done: false },
    { id: `c5_${Date.now()}`, text: '8 月 16 日交付范围是否排除 Group By', done: false }
  ],
  blockers: [],
  decisions: [],
  conclusion: '',
  updatedAt: new Date().toISOString()
});

const ProgressBar = ({ progress, onChange, colorClass }: { progress: number, onChange: (p: number) => void, colorClass: string }) => {
  const barRef = useRef<HTMLDivElement>(null);
  
  const handleDrag = (e: React.MouseEvent | MouseEvent) => {
    if (!barRef.current) return;
    const rect = barRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
    const newProgress = Math.round((x / rect.width) * 100);
    onChange(newProgress);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    handleDrag(e);
    const onMouseMove = (moveEvent: MouseEvent) => handleDrag(moveEvent);
    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  };

  return (
    <div 
      ref={barRef}
      className="h-6 bg-gray-100 rounded-full cursor-ew-resize relative border border-gray-200 shadow-inner overflow-hidden"
      onMouseDown={handleMouseDown}
      title="拖拽或点击调整进度"
    >
      <div 
        className={`h-full transition-all duration-75 ${colorClass}`}
        style={{ width: `${progress}%` }}
      ></div>
      <div className="absolute inset-0 flex items-center justify-center text-[10px] font-bold pointer-events-none mix-blend-difference text-white">
        {progress}%
      </div>
    </div>
  );
};

export default function App() {
  const today = new Date(Date.now() + 8 * 3600 * 1000).toISOString().split('T')[0];
  const [state, setState] = useState<AppState>(() => {
    const today = new Date(Date.now() + 8 * 3600 * 1000).toISOString().split('T')[0];
    try {
      const saved = localStorage.getItem('mcpBoardState_v3');
      if (saved) {
        const parsed = JSON.parse(saved);
        parsed.currentDate = today;
        return parsed;
      }
    } catch (e) {
      console.error('Failed to load state from local storage', e);
    }
    return {
      ...defaultState,
      currentDate: today,
      currentEditingMeetingDate: today,
      meetingRecords: defaultState.meetingRecords.map(m => ({ ...m, date: today }))
    };
  });

  const [saving, setSaving] = useState(false);
  const saveTimeout = useRef<NodeJS.Timeout>();

  const [exportImageUrl, setExportImageUrl] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [exportFormat, setExportFormat] = useState<'png' | 'jpg' | 'svg'>('png');

  useEffect(() => {
    setSaving(true);
    if (saveTimeout.current) clearTimeout(saveTimeout.current);
    saveTimeout.current = setTimeout(() => {
      localStorage.setItem('mcpBoardState_v3', JSON.stringify(state));
      setSaving(false);
    }, 500);
  }, [state]);

  const generateImage = async (format: 'png' | 'jpg' | 'svg') => {
    const element = document.getElementById('export-container');
    if (!element) return;
    
    setIsExporting(true);
    try {
      let dataUrl = '';
      const options = {
        quality: 0.95,
        backgroundColor: '#f9fafb',
        pixelRatio: 2,
        style: {
          transform: 'scale(1)',
          transformOrigin: 'top left',
          width: element.clientWidth + 'px',
          height: element.clientHeight + 'px',
        },
      };

      if (format === 'png') {
        dataUrl = await htmlToImage.toPng(element, options);
      } else if (format === 'jpg') {
        dataUrl = await htmlToImage.toJpeg(element, options);
      } else if (format === 'svg') {
        dataUrl = await htmlToImage.toSvg(element, options);
      }

      setExportImageUrl(dataUrl);
    } catch (e) {
      console.error('Failed to export image', e);
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportImage = async () => {
    setIsExportModalOpen(true);
    setExportImageUrl(null);
    setExportFormat('png');
    // Give DOM a tick to render
    setTimeout(() => {
      generateImage('png');
    }, 100);
  };

  const handleDownload = () => {
    if (!exportImageUrl) return;
    const extension = exportFormat;
    const fileName = `项目进度同步_${state.currentDate}.${extension}`;
    
    try {
      const blob = dataURLtoBlob(exportImageUrl);
      if (blob) {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setTimeout(() => URL.revokeObjectURL(url), 100);
      } else {
        throw new Error('Blob creation failed');
      }
    } catch (err) {
      console.error('Download failed, using fallback', err);
      const link = document.createElement('a');
      link.href = exportImageUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  // Calculations
  const daysLeft = getDaysBetween(state.currentDate, state.targetDate);
  const overallProgress = state.tasks.length > 0 ? Math.round(state.tasks.reduce((sum, t) => sum + t.progress, 0) / state.tasks.length) : 0;
  
  const highPriorityTasks = state.tasks.filter(t => t.priority === 'Highest');
  const highPriorityProgress = highPriorityTasks.length > 0 ? Math.round(highPriorityTasks.reduce((sum, t) => sum + t.progress, 0) / highPriorityTasks.length) : 0;
  
  const projectTotalDays = getDaysBetween(today, state.targetDate);
  const projectCurrentDays = getDaysBetween(today, state.currentDate);
  let expectedOverall = 0;
  if (projectTotalDays > 0 && projectCurrentDays > 0) {
    expectedOverall = (projectCurrentDays / projectTotalDays) * 100;
    expectedOverall = Math.max(0, Math.min(100, expectedOverall));
  }
  
  const isTaskBehind = (task: McpToolTask) => {
    const total = getDaysBetween(task.startDate, task.endDate);
    if (total <= 0) return false;
    const currentOffset = getDaysBetween(task.startDate, state.currentDate);
    if (currentOffset <= 0) return false;
    let expected = (currentOffset / total) * 100;
    expected = Math.max(0, Math.min(100, expected));
    return task.progress < expected - 10;
  };

  const getTaskStatusInfo = (task: McpToolTask) => {
     if (task.progress >= 100) return { label: '已完成', style: 'border-green-300 bg-green-50 text-green-700', isDanger: false };
     if (task.risk) return { label: '阻塞风险', style: 'border-red-300 bg-red-50 text-red-700', isDanger: true };
     if (isTaskBehind(task)) return { label: '延期风险', style: 'border-red-300 bg-red-50 text-red-700', isDanger: true };
     if (task.progress > 0) return { label: '进行中', style: 'border-blue-300 bg-blue-50 text-blue-700', isDanger: false };
     return { label: '未开始', style: 'border-gray-200 bg-white text-gray-700', isDanger: false };
  };

  const hasRisk = (t: McpToolTask) => getTaskStatusInfo(t).isDanger;

  const getPriorityBadge = (priority: Priority) => {
    switch (priority) {
      case 'Highest': return <span className="bg-[#FFC72C] text-black px-2 py-0.5 rounded-full text-[10px] font-bold">最高优先</span>;
      case 'Lower': return <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full text-[10px] font-bold">较低优先</span>;
      case 'Lowest': return <span className="bg-gray-100 text-gray-700 px-2 py-0.5 rounded-full text-[10px] font-bold">最低优先</span>;
      case 'Release Phase': return <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded-full text-[10px] font-bold">发布验收</span>;
      default: return null;
    }
  };
  
  const getProgressColor = (task: McpToolTask) => {
    const info = getTaskStatusInfo(task);
    if (info.label === '已完成') return 'bg-green-500';
    if (info.isDanger) return 'bg-[#DA291C]';
    return 'bg-[#FFC72C]';
  };

  const handleTaskChange = (id: string, field: keyof McpToolTask, value: any) => {
    setState(prev => ({
      ...prev,
      tasks: prev.tasks.map(t => {
        if (t.id === id) {
          const updated = { ...t, [field]: value };
          if (field === 'progress' && value === 100 && t.status !== 'Completed') {
            updated.status = 'Completed';
          }
          if (field === 'progress' && value > 0 && value < 100 && t.status === 'Not Started') {
            updated.status = 'In Progress';
          }
          return updated;
        }
        return t;
      })
    }));
  };

  const getDeliveryJudgment = () => {
    const queryTask = state.tasks.find(t => t.toolName === 'query_dataservice');
    if (queryTask && hasRisk(queryTask)) {
      return { level: '🔴 高风险', text: '数据查询任务存在交付风险，主链路受阻！', color: 'bg-red-50 border-red-200 text-red-800', iconColor: 'text-[#DA291C]' };
    }

    if (highPriorityProgress < expectedOverall - 15) {
      return { level: '🔴 高风险', text: '核心 MCP Tools 整体进度严重落后计划！', color: 'bg-red-50 border-red-200 text-red-800', iconColor: 'text-[#DA291C]' };
    }

    const groupByTask = state.tasks.find(t => t.toolName === 'query_dataservice.groupBy');
    if (groupByTask && hasRisk(groupByTask)) {
      return { level: '🟨 可控', text: 'Group By 存在风险，但属可选能力，可延期交付，不影响核心链路。', color: 'bg-yellow-50 border-yellow-200 text-yellow-800', iconColor: 'text-[#FFC72C]' };
    }

    return { level: '🟢 良好', text: '核心 MCP 能力按计划推进，风险处于可控范围内。', color: 'bg-green-50 border-green-200 text-green-800', iconColor: 'text-green-500' };
  };

  const timelineStart = today;
  const totalTimelineDays = getDaysBetween(timelineStart, state.targetDate) || 48;
  const todayOffsetPct = Math.max(0, Math.min(100, (getDaysBetween(timelineStart, state.currentDate) / totalTimelineDays) * 100));

  return (
    <>
      <div id="export-container" className="min-h-screen bg-gray-50 text-gray-900 font-sans selection:bg-[#FFC72C] selection:text-black pb-20">
      
      {/* Header */}
      <header className="bg-[#FFC72C] border-b border-gray-200 sticky top-0 z-50 shadow-sm">
        <div className="max-w-[1400px] mx-auto px-6 py-3 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-black tracking-tight">
              数据服务平台 MCP 战情板
            </h1>
            <span className="bg-white/50 text-black px-2 py-0.5 rounded-full text-xs font-bold ml-2">
              Iter 1 / 4
            </span>
          </div>
          
          <div className="flex items-center gap-4">
             <div className="flex items-center gap-2 text-sm font-medium">
               <span className="text-black/70">项目开始</span>
               <div className="bg-white/50 border border-black/10 rounded-md px-2 py-1 text-sm font-semibold text-black">
                 2026-06-29
               </div>
             </div>
             <div className="flex items-center gap-2 text-sm font-medium">
               <span className="text-black/70">目标交付</span>
               <div className="bg-white/50 border border-black/10 rounded-md px-2 py-1 text-sm font-semibold text-black">
                 2026-08-06
               </div>
             </div>
             
             <div className="h-6 w-px bg-black/20 mx-2 hidden md:block"></div>

             <div className="flex items-center gap-2 text-sm font-medium">
               <span className="text-black/70">当日时间</span>
               <input 
                 type="date"
                 className="bg-white/50 border border-black/10 rounded-md px-2 py-1 text-sm font-semibold text-black outline-none focus:ring-2 focus:ring-black/50"
                 value={state.currentDate}
                 onChange={e => setState(s => ({ ...s, currentDate: e.target.value }))}
               />
             </div>
             
             <div className="h-6 w-px bg-black/20 mx-2 hidden md:block"></div>
             
             <div className="flex items-center gap-3">
                <button onClick={handleExportImage} disabled={isExporting} className="p-1.5 hover:bg-black/10 rounded-md transition-colors flex items-center justify-center disabled:opacity-50" title={isExporting ? "生成中..." : "导出为图片同步微信群"}>
                  {isExporting ? <RotateCcw className="w-4 h-4 text-black animate-spin" /> : <ImageIcon className="w-4 h-4 text-black" />}
                </button>
             </div>
          </div>
        </div>
      </header>

      <div className="max-w-[1400px] mx-auto p-6 space-y-6">

        {/* AI Summary Banner */}
        <div className="bg-gradient-to-r from-indigo-50 to-blue-50 rounded-xl p-5 border border-indigo-100 shadow-sm flex items-start gap-4">
           <div className="bg-indigo-100 text-indigo-600 p-2 rounded-lg shrink-0 mt-0.5">
              <Sparkles className="w-5 h-5" />
           </div>
           <div>
              <h3 className="text-indigo-900 font-bold text-sm mb-1">AI 智能进度风险分析</h3>
              <p className="text-indigo-800/80 text-sm leading-relaxed">
                当前项目整体进度 {overallProgress}%，时间进度 {Math.round(expectedOverall)}%。
                {overallProgress < expectedOverall ? `进度落后于时间进度约 ${Math.round(expectedOverall - overallProgress)}%，` : `进度健康，`}
                距交付剩余 {daysLeft} 天。
                <span className="font-semibold ml-1">判定建议：{getDeliveryJudgment().level} - {getDeliveryJudgment().text}</span>
              </p>
           </div>
        </div>

        {/* Project Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 flex flex-col justify-between">
            <div className="text-gray-500 text-xs font-semibold mb-2 flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" /> 距交付剩余
            </div>
            <div className="flex items-baseline gap-1">
               <span className={`text-3xl font-bold ${daysLeft < 14 ? 'text-[#DA291C]' : 'text-gray-900'}`}>{daysLeft}</span>
               <span className="text-sm text-gray-500 font-medium">天</span>
               <span className="ml-2 text-xs text-gray-400">
                 (已开发 {Math.max(0, projectCurrentDays)} 天 / 总计 {projectTotalDays} 天，约 {Math.ceil(projectTotalDays / 7)} 个迭代周)
               </span>
            </div>
          </div>
          
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 flex flex-col justify-between">
            <div className="text-gray-500 text-xs font-semibold mb-2 flex items-center justify-between">
              <span className="flex items-center gap-1"><Target className="w-3.5 h-3.5" /> 整体完成度</span>
              {overallProgress < expectedOverall && <span className="text-red-500 text-[10px] px-1.5 py-0.5 bg-red-50 rounded">进度落后</span>}
            </div>
            <div className="flex items-baseline gap-1 mb-2">
               <span className="text-3xl font-bold text-gray-900">{overallProgress}</span>
               <span className="text-sm text-gray-500 font-medium">%</span>
            </div>
            <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden relative">
               <div className="absolute top-0 bottom-0 bg-gray-400 w-0.5 z-20" style={{ left: `${expectedOverall}%` }} title={`时间进度: ${Math.round(expectedOverall)}%`}></div>
               <div className="h-full bg-blue-500 rounded-full transition-all relative z-10" style={{ width: `${overallProgress}%` }}></div>
            </div>
            <div className="text-[10px] text-gray-500 mt-2 flex justify-between">
               <span>实际: {overallProgress}%</span>
               <span className={overallProgress < expectedOverall ? 'text-red-500 font-bold' : ''}>时间进度: {Math.round(expectedOverall)}%</span>
            </div>
          </div>
        </div>

        {/* Timeline & Judgment */}
        <div className="grid grid-cols-1 gap-6">
           <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
              <div className="flex justify-between items-center mb-4">
                 <div className="flex items-center gap-4">
                    <h2 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-gray-500" /> 交付节奏与关键路径
                    </h2>
                    <div className={`px-2 py-1 rounded text-xs font-bold flex items-center gap-1.5 ${getDeliveryJudgment().color}`}>
                       <AlertTriangle className={`w-3 h-3 ${getDeliveryJudgment().iconColor}`} />
                       {getDeliveryJudgment().level}: {getDeliveryJudgment().text}
                    </div>
                 </div>
                 <div className="text-[10px] font-medium text-gray-500 bg-gray-100 px-2 py-1 rounded">
                   关键路径：服务列表 → 服务元数据 → 数据查询 → 联调验证 → 回归验收
                 </div>
              </div>
              <div className="relative pt-8 pb-2 px-2 overflow-x-auto no-scrollbar">
                <div className="min-w-[600px] relative">
                  <div className="absolute top-3 left-4 right-4 border-t-2 border-gray-100"></div>
                  <div className="flex justify-between relative mt-2">
                    {[
                      { date: '06/29', phase: '迭代 1', desc: '接口设计' },
                      { date: '07/12', phase: '迭代 2', desc: '核心查询' },
                      { date: '07/26', phase: '迭代 3', desc: '枚举值/GroupBy' },
                      { date: '08/09', phase: '发布验收', desc: '回归/文档/验收' },
                      { date: '08/16', phase: '对外交付', desc: 'Go Live' },
                    ].map((milestone, idx) => {
                      const mDate = `2026-${milestone.date.replace('/', '-')}`;
                      const isPast = state.currentDate > mDate;
                      const isToday = state.currentDate === mDate;
                      const isDone = isPast || isToday;
                      return (
                      <div key={idx} className="flex flex-col items-center w-24 -ml-12 first:ml-0 last:-mr-12 relative">
                        {isToday && (
                           <div className="absolute -top-6 bg-red-500 text-white text-[9px] px-1.5 py-0.5 rounded font-bold whitespace-nowrap">
                             当前节点
                             <div className="absolute bottom-[-3px] left-1/2 -translate-x-1/2 border-l-[3px] border-l-transparent border-r-[3px] border-r-transparent border-t-[4px] border-t-red-500"></div>
                           </div>
                        )}
                        <div className={`w-3 h-3 border-2 rounded-full mb-2 z-10 ${isDone ? 'bg-green-500 border-green-600' : 'bg-white border-[#FFC72C]'}`}></div>
                        <div className={`text-xs font-bold ${isDone ? 'text-green-700' : 'text-gray-900'} bg-white px-1`}>{milestone.date}</div>
                        <div className="text-[10px] font-semibold text-gray-600 mt-1">{milestone.phase}</div>
                        <div className="text-[10px] text-gray-400 mt-0.5 text-center leading-tight">{milestone.desc}</div>
                      </div>
                    )})}
                  </div>
                </div>
              </div>
           </div>
        </div>

        {/* Gantt Chart Area */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
            <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
              MCP Tools 进展甘特图
            </h2>
            <div className="flex gap-4 text-[10px] font-medium text-gray-500">
               <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-[#FFC72C]"></div> 正常</span>
               <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-green-500"></div> 已完成</span>
               <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-[#DA291C]"></div> 风险/阻塞</span>
            </div>
          </div>
          
          <div className="flex border-b border-gray-100 bg-gray-50 text-xs text-gray-500 font-semibold sticky top-[68px] z-20">
             <div className="w-full lg:w-[280px] p-3 shrink-0 lg:border-r border-gray-100 hidden lg:block">接口模块与状态</div>
             <div className="flex-1 relative hidden lg:flex items-center border-r border-gray-100 overflow-hidden">
                <div className="absolute inset-0 flex pointer-events-none">
                  {[...Array(totalTimelineDays > 0 ? Math.ceil(totalTimelineDays/7) : 8)].map((_, i) => {
                    const start = new Date(timelineStart);
                    start.setDate(start.getDate() + i * 7);
                    const end = new Date(start);
                    end.setDate(end.getDate() + 6);
                    const weekStr = `${formatDate(start).slice(5)}至${formatDate(end).slice(5)}`;
                    return (
                      <div key={i} className="flex-1 border-r border-dashed border-gray-300 relative flex flex-col justify-end pb-1 pl-2">
                         <span className="text-[10px] text-gray-500 font-bold leading-none">W{i+1}</span>
                         <span className="text-[8px] text-gray-400 mt-0.5 leading-none">{weekStr}</span>
                      </div>
                    );
                  })}
                </div>
                <div 
                  className="absolute top-0 bottom-0 border-l-2 border-red-500 z-10"
                  style={{ left: `${todayOffsetPct}%` }}
                >
                  <div className="bg-red-500 text-white text-[9px] px-1 py-0.5 rounded-sm absolute top-1 -translate-x-1/2 whitespace-nowrap">今日</div>
                </div>
             </div>
             <div className="w-full lg:w-[360px] p-3 shrink-0 hidden lg:block text-center">进展、问题与计划</div>
          </div>

          <div className="divide-y divide-gray-100">
            {state.tasks.map(task => {
              const startOffset = Math.max(0, getDaysBetween(timelineStart, task.startDate));
              const duration = getDaysBetween(task.startDate, task.endDate);
              const leftPct = (startOffset / totalTimelineDays) * 100;
              const widthPct = (duration / totalTimelineDays) * 100;
              const hasRiskNote = (task.risk || '').trim() !== '';
              const statusInfo = getTaskStatusInfo(task);
              const isDanger = statusInfo.isDanger;

              return (
                <div key={task.id} className={`flex flex-col lg:flex-row hover:bg-gray-50 transition-colors group ${isDanger ? 'bg-red-50/30' : ''}`}>
                  
                  {/* Left: Info */}
                  <div className="w-full lg:w-[280px] p-3 border-b lg:border-b-0 lg:border-r border-gray-100 flex flex-col shrink-0 justify-center gap-2">
                     <div className="flex items-start justify-between">
                        <div>
                           <div className="font-bold text-sm text-gray-900 flex items-center gap-1.5">
                             {isDanger && <AlertTriangle className="w-3.5 h-3.5 text-[#DA291C]" />}
                             {task.name}
                           </div>
                           <div className="text-[10px] text-gray-400 font-mono mt-0.5">{task.toolName}</div>
                        </div>
                        {getPriorityBadge(task.priority)}
                     </div>
                     <div className="grid grid-cols-2 gap-2 mt-1">
                        <div className={`text-xs p-1 border rounded font-medium h-7 flex items-center justify-center ${statusInfo.style}`}>
                          {statusInfo.label}
                        </div>
                        <select 
                          className={`text-xs p-1 border rounded outline-none font-medium h-7 ${task.risk ? 'border-yellow-300 bg-yellow-50 text-yellow-700' : 'border-gray-200 bg-white text-gray-700'}`}
                          value={task.risk ? 'Has Risk' : 'No Risk'}
                          onChange={e => handleTaskChange(task.id, 'risk', e.target.value === 'Has Risk' ? '需排查' : '')}
                        >
                          <option value="No Risk">无风险/已解决</option>
                          <option value="Has Risk">有风险/待处理</option>
                        </select>
                     </div>
                  </div>

                  {/* Middle: Unified Timeline Row */}
                  <div className="w-full lg:flex-1 p-0 border-b lg:border-b-0 lg:border-r border-gray-100 relative min-h-[60px] flex items-center overflow-visible">
                    <div className="absolute inset-0 flex pointer-events-none">
                      {[...Array(totalTimelineDays > 0 ? Math.ceil(totalTimelineDays/7) : 8)].map((_, i) => (
                        <div key={i} className="flex-1 border-r border-dashed border-gray-100"></div>
                      ))}
                    </div>
                    {/* Today Line Extension */}
                    <div 
                      className="absolute top-0 bottom-0 border-l-2 border-red-500/20 z-0 pointer-events-none"
                      style={{ left: `${todayOffsetPct}%` }}
                    ></div>
                    
                    <div className="relative w-full h-8 z-10 mx-2">
                       <div 
                         className="absolute top-1/2 -translate-y-1/2 rounded"
                         style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
                       >
                         <ProgressBar 
                           progress={task.progress} 
                           onChange={(p) => handleTaskChange(task.id, 'progress', p)}
                           colorClass={getProgressColor(task)}
                         />
                         <div className="flex justify-between text-[9px] font-mono font-medium mt-0.5 text-gray-400 absolute -bottom-3 left-0 right-0 opacity-0 group-hover:opacity-100 transition-opacity">
                           <input type="date" className="bg-transparent border-none outline-none p-0 cursor-pointer w-20" value={task.startDate} onChange={e => handleTaskChange(task.id, 'startDate', e.target.value)} />
                           <input type="date" className="bg-transparent border-none outline-none p-0 cursor-pointer text-right w-20" value={task.endDate} onChange={e => handleTaskChange(task.id, 'endDate', e.target.value)} />
                         </div>
                       </div>
                    </div>
                  </div>

                  {/* Right: Notes Editable */}
                  <div className="w-full lg:w-[360px] p-3 flex flex-col gap-2 shrink-0 bg-gray-50/30">
                     <textarea 
                       className="w-full bg-white border border-gray-200 rounded p-1.5 text-xs outline-none resize-none focus:border-blue-400 transition-colors" 
                       rows={1} 
                       placeholder="本周进展..."
                       value={task.weekProgress || ''} 
                       onChange={e => handleTaskChange(task.id, 'weekProgress', e.target.value)} 
                     />
                     <div className="flex gap-2">
                       {hasRiskNote && (
                         <textarea 
                           className={`w-1/2 border rounded p-1.5 text-xs outline-none resize-none transition-colors ${hasRiskNote ? 'bg-red-50 border-red-200 text-red-800' : 'bg-white border-gray-200'}`} 
                           rows={1} 
                           placeholder="问题/风险..."
                           value={task.risk || ''} 
                           onChange={e => handleTaskChange(task.id, 'risk', e.target.value)} 
                         />
                       )}
                       <input 
                         className={`${hasRiskNote ? 'w-1/2' : 'w-full'} bg-white border border-gray-200 rounded p-1.5 text-xs outline-none focus:border-blue-400 transition-colors`} 
                         placeholder="下周计划..."
                         value={task.nextWeekPlan || ''} 
                         onChange={e => handleTaskChange(task.id, 'nextWeekPlan', e.target.value)} 
                       />
                     </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

      </div>
    </div>
    
      {isExportModalOpen && (
        <div className="fixed inset-0 z-[100] bg-black/80 flex flex-col items-center justify-center p-6 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl overflow-hidden w-full max-w-4xl max-h-[90vh] flex flex-col">
            <div className="p-4 border-b flex flex-wrap gap-4 justify-between items-center bg-gray-50 shrink-0">
              <div className="flex items-center gap-4">
                <h3 className="font-bold text-gray-900 text-sm md:text-base">进度战情板截图</h3>
                {/* Format switcher */}
                <div className="flex bg-gray-200/80 p-0.5 rounded-lg border border-gray-300/10">
                  {(['png', 'jpg', 'svg'] as const).map((fmt) => (
                    <button
                      key={fmt}
                      onClick={() => {
                        setExportFormat(fmt);
                        setExportImageUrl(null);
                        setIsExporting(true);
                        setTimeout(() => {
                          generateImage(fmt);
                        }, 100);
                      }}
                      className={`px-3 py-1 text-xs font-bold rounded-md transition-all uppercase ${
                        exportFormat === fmt
                          ? 'bg-white text-gray-900 shadow-sm'
                          : 'text-gray-500 hover:text-gray-900'
                      }`}
                    >
                      {fmt}
                    </button>
                  ))}
                </div>
              </div>
              
              <div className="flex gap-2">
                <button
                  disabled={isExporting || !exportImageUrl}
                  onClick={handleDownload}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  下载 {exportFormat.toUpperCase()} 图片
                </button>
                <button 
                  onClick={() => {
                    setIsExportModalOpen(false);
                    setExportImageUrl(null);
                  }}
                  className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md text-sm font-medium hover:bg-gray-300 transition-colors"
                >
                  关闭
                </button>
              </div>
            </div>
            
            <div className="p-4 overflow-auto bg-gray-100 flex-1 flex items-center justify-center min-h-[350px]">
              {isExporting ? (
                <div className="flex flex-col items-center gap-3">
                  <RotateCcw className="w-8 h-8 text-blue-600 animate-spin" />
                  <span className="text-sm font-semibold text-gray-600">正在生成高清 {exportFormat.toUpperCase()} 格式中...</span>
                </div>
              ) : exportImageUrl ? (
                <div className="cursor-pointer max-w-full" title="点击下载图片" onClick={handleDownload}>
                  <img src={exportImageUrl} alt="进度截图" className="max-w-full h-auto shadow-sm ring-1 ring-black/5 hover:opacity-90 transition-opacity rounded-lg" />
                </div>
              ) : (
                <div className="text-sm text-gray-500 font-semibold">生成失败，请切换格式或重试</div>
              )}
            </div>
            
            <div className="p-3 text-center text-xs text-gray-500 bg-white border-t shrink-0">
              如果点击“下载”按钮无反应，可右键（或长按）上方图片，选择“存储图像/另存为”。
            </div>
          </div>
        </div>
      )}
    </>
  );
}
