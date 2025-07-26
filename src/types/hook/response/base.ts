// Hook応答の基本型定義
export interface BaseHookResponse {
  continue?: boolean;
  stopReason?: string;
  suppressOutput?: boolean;
}
