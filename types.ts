
export enum ResponseType {
  POSITIVE = '긍정',
  DISSATISFACTION = '부정',
  MISUNDERSTANDING = '오해',
  EMOTIONAL_COMPLAINT = '감정적'
}

export enum Channel {
  NAVER_PLACE = '네이버 플레이스',
  KAKAOTALK = '카카오톡',
  SMS = '문자'
}

export enum ToneManner {
  WARM = '따뜻함',
  CALM = '차분함',
  PROFESSIONAL = '전문적',
  FRIENDLY = '친근함',
  SIMPLICITY = '간결함'
}

export enum EndingStyle {
  SOFT = '~에요',
  FORMAL = '~입니다'
}

export interface GenerationResult {
  title: string;
  body: string;
  caution: string;
}

export interface RequestConfig {
  responseType: ResponseType;
  channel: Channel;
  tone: ToneManner;
  endingStyle: EndingStyle;
  content: string;
  imageData?: string; // base64
  hospitalName: string;
}
