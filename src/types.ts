export type Priority = 'Highest' | 'Lower' | 'Lowest' | 'Release Phase';
export type TaskStatus = 'Not Started' | 'In Progress' | 'Completed' | 'Blocked' | 'At Risk';
export type BlockerStatus = '未解决' | '处理中' | '已解决';

export interface McpToolTask {
  id: string;
  name: string;
  toolName: string;
  priority: Priority;
  owner: string;
  status: TaskStatus;
  progress: number;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  weekProgress: string;
  nextWeekPlan: string;
  risk: string;
}

export interface ConfirmItem {
  id: string;
  text: string;
  done: boolean;
}

export interface TextItem {
  id: string;
  text: string;
}

export interface BlockerItem {
  id: string;
  title: string;
  impact: string;
  owner: string;
  eta: string;
  status: BlockerStatus;
}

export interface DecisionItem {
  id: string;
  content: string;
  owner: string;
  dueDate: string;
  relatedTaskId?: string;
}

export interface MeetingRecord {
  id: string;
  date: string;
  confirmations: ConfirmItem[];
  blockers: BlockerItem[];
  decisions: DecisionItem[];
  conclusion: string;
  updatedAt: string;
}

export interface AppState {
  currentDate: string;
  targetDate: string;
  tasks: McpToolTask[];
  meetingRecords: MeetingRecord[];
  currentEditingMeetingDate: string;
}

