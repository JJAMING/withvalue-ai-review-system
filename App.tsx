
import React, { useState, useEffect } from 'react';
import { SelectionGroup } from './components/SelectionGroup';
import { ResponseType, Channel, ToneManner, EndingStyle, GenerationResult, RequestConfig } from './types';
import { generateReviewResponse } from './geminiService';

const MAX_IMAGE_SIZE_MB = 5;
const MAX_IMAGE_SIZE_BYTES = MAX_IMAGE_SIZE_MB * 1024 * 1024;
const MAX_IMAGE_DIMENSION = 1600;
const COMPRESSED_IMAGE_TYPE = 'image/jpeg';
const COMPRESSED_IMAGE_QUALITY = 0.82;

type ImageCompressionInfo = {
  originalSize: number;
  compressedSize: number;
};

type RiskRule = {
  phrase: string;
  category: string;
  guidance: string;
};

const RISK_RULES: RiskRule[] = [
  { phrase: '완치', category: '치료 결과 보장', guidance: '치료 결과를 단정하지 말고 개선 가능성이나 진료 계획 중심으로 바꿔주세요.' },
  { phrase: '100%', category: '치료 결과 보장', guidance: '절대적 수치 표현은 피하고 개별 상태에 따라 달라질 수 있음을 남겨주세요.' },
  { phrase: '무조건', category: '치료 결과 보장', guidance: '환자 상태에 따라 달라질 수 있는 표현으로 완화해주세요.' },
  { phrase: '반드시 효과', category: '치료 결과 보장', guidance: '효과 보장 대신 진료 원칙과 확인 절차를 설명해주세요.' },
  { phrase: '보장', category: '치료 결과 보장', guidance: '결과 보장으로 읽힐 수 있어 확인/관리/노력 표현으로 바꿔주세요.' },
  { phrase: '재발 없음', category: '치료 결과 보장', guidance: '재발 가능성을 단정하지 말고 정기 관리의 중요성을 안내해주세요.' },
  { phrase: '최고', category: '최상급 표현', guidance: '객관적 근거 없는 최상급 표현은 피하고 병원의 진료 태도를 설명해주세요.' },
  { phrase: '유일', category: '최상급 표현', guidance: '독점적 표현은 객관적 근거가 없으면 삭제하거나 완화해주세요.' },
  { phrase: '1위', category: '최상급 표현', guidance: '순위 표현은 공식 근거가 없으면 사용하지 않는 편이 안전합니다.' },
  { phrase: '가장 잘하는', category: '최상급 표현', guidance: '비교 우위 표현 대신 성실한 진료 경험을 강조해주세요.' },
  { phrase: '완벽', category: '과장 표현', guidance: '완벽을 약속하는 표현은 피하고 꼼꼼함, 세심함 같은 과정 표현으로 바꿔주세요.' },
  { phrase: '통증 없이', category: '무통/부작용 단정', guidance: '통증 여부를 단정하지 말고 통증을 줄이기 위해 노력한다는 표현으로 바꿔주세요.' },
  { phrase: '전혀 아프지', category: '무통/부작용 단정', guidance: '무통을 단정하지 말고 개인차가 있음을 전제로 완화해주세요.' },
  { phrase: '무통', category: '무통/부작용 단정', guidance: '무통 표현은 통증 관리 또는 통증 완화 노력으로 바꿔주세요.' },
  { phrase: '부작용 없음', category: '무통/부작용 단정', guidance: '부작용이 없다고 단정하지 말고 충분한 설명과 확인 절차를 안내해주세요.' },
  { phrase: '타 병원보다', category: '비교 표현', guidance: '다른 병원과 직접 비교하는 표현은 피하고 자체 진료 원칙을 설명해주세요.' },
  { phrase: '다른 곳보다', category: '비교 표현', guidance: '비교 표현 대신 병원이 중요하게 여기는 기준을 설명해주세요.' },
];

const findRiskyPhrases = (text: string) => {
  const normalizedText = text.toLowerCase();
  const matched = RISK_RULES.filter((rule) => normalizedText.includes(rule.phrase.toLowerCase()));

  return matched.filter((rule, index, rules) => {
    return rules.findIndex((item) => item.phrase === rule.phrase) === index;
  });
};

const formatFileSize = (bytes: number) => {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
  }

  return `${Math.max(1, Math.round(bytes / 1024))}KB`;
};

const readBlobAsDataUrl = (blob: Blob) => {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('이미지를 읽지 못했습니다.'));
    reader.readAsDataURL(blob);
  });
};

const loadImageFromFile = (file: File) => {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    const url = URL.createObjectURL(file);

    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('이미지 형식을 읽지 못했습니다.'));
    };
    image.src = url;
  });
};

const canvasToBlob = (canvas: HTMLCanvasElement) => {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error('이미지 압축에 실패했습니다.'));
        }
      },
      COMPRESSED_IMAGE_TYPE,
      COMPRESSED_IMAGE_QUALITY
    );
  });
};

const compressImageFile = async (file: File) => {
  const image = await loadImageFromFile(file);
  const scale = Math.min(1, MAX_IMAGE_DIMENSION / Math.max(image.naturalWidth, image.naturalHeight));
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');

  if (!context) {
    throw new Error('이미지를 압축할 수 없습니다.');
  }

  canvas.width = width;
  canvas.height = height;
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, width, height);
  context.drawImage(image, 0, 0, width, height);

  const compressedBlob = await canvasToBlob(canvas);
  const dataUrl = await readBlobAsDataUrl(compressedBlob);

  return {
    dataUrl,
    base64: dataUrl.split(',')[1],
    mimeType: compressedBlob.type || COMPRESSED_IMAGE_TYPE,
    compressedSize: compressedBlob.size,
  };
};

export default function App() {
  const [hospitalName, setHospitalName] = useState(() => {
    return localStorage.getItem('hospital_name') || '';
  });
  const [responseType, setResponseType] = useState<ResponseType>(ResponseType.POSITIVE);
  const [channel, setChannel] = useState<Channel>(Channel.NAVER_PLACE);
  const [tone, setTone] = useState<ToneManner>(ToneManner.WARM);
  const [endingStyle, setEndingStyle] = useState<EndingStyle>(EndingStyle.FORMAL);
  const [content, setContent] = useState('');
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageData, setImageData] = useState<string | undefined>();
  const [imageMimeType, setImageMimeType] = useState<string | undefined>();
  const [imageCompressionInfo, setImageCompressionInfo] = useState<ImageCompressionInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<GenerationResult | null>(null);
  const [copyStatus, setCopyStatus] = useState('복사하기');
  const riskMatches = result ? findRiskyPhrases(result.body) : [];

  useEffect(() => {
    localStorage.setItem('hospital_name', hospitalName);
  }, [hospitalName]);

  const processFile = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      alert('이미지 파일만 첨부할 수 있습니다.');
      return;
    }

    try {
      const compressed = await compressImageFile(file);

      if (compressed.compressedSize > MAX_IMAGE_SIZE_BYTES) {
        alert(`자동 압축 후에도 이미지는 ${MAX_IMAGE_SIZE_MB}MB 이하만 첨부할 수 있습니다.`);
        return;
      }

      setImagePreview(compressed.dataUrl);
      setImageData(compressed.base64);
      setImageMimeType(compressed.mimeType);
      setImageCompressionInfo({
        originalSize: file.size,
        compressedSize: compressed.compressedSize,
      });
    } catch (error) {
      console.error(error);
      alert(error instanceof Error ? error.message : '이미지를 압축하지 못했습니다.');
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData?.items;
    if (items) {
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const file = items[i].getAsFile();
          if (file) {
            processFile(file);
            // 텍스트 영역에 파일명이 적히는 등의 현상을 방지하고 싶다면 e.preventDefault()를 쓸 수 있지만,
            // 보통 텍스트와 이미지를 동시에 붙여넣는 경우도 있으므로 여기서는 파일만 추출합니다.
          }
        }
      }
    }
  };

  const removeImage = () => {
    setImagePreview(null);
    setImageData(undefined);
    setImageMimeType(undefined);
    setImageCompressionInfo(null);
  };

  const handleGenerate = async () => {
    if (!hospitalName.trim()) {
      alert('치과명을 입력해 주세요.');
      return;
    }
    if (!content && !imageData) {
      alert('리뷰 내용이나 사진을 제공해주세요.');
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      const config: RequestConfig = { 
        responseType, 
        channel, 
        tone, 
        endingStyle,
        content, 
        imageData,
        imageMimeType,
        hospitalName
      };
      const data = await generateReviewResponse(config);
      setResult(data);
      window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
    } catch (error) {
      console.error(error);
      alert(error instanceof Error ? error.message : '답변 생성 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = () => {
    if (!result) return;
    if (riskMatches.length > 0) {
      const shouldCopy = window.confirm('위험 표현이 감지되었습니다. 의료진 검수 후 복사하시겠습니까?');
      if (!shouldCopy) return;
    }

    const text = result.body;
    navigator.clipboard.writeText(text).then(() => {
      setCopyStatus('복사 완료');
      setTimeout(() => setCopyStatus('복사하기'), 2000);
    });
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 selection:bg-indigo-100 pb-10">
      <nav className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-slate-200 px-4 sm:px-6 py-3">
        <div className="max-w-5xl mx-auto flex justify-between items-center gap-2">
          <div className="flex items-center gap-3 shrink-0">
            <div className="flex items-center gap-2 group cursor-pointer" onClick={() => window.scrollTo({top: 0, behavior: 'smooth'})}>
              <div className="w-9 h-9 sm:w-10 sm:h-10 bg-[#6d4c41] rounded-full flex items-center justify-center shadow-md transition-transform group-hover:scale-105">
                <svg className="w-5 h-5 sm:w-6 sm:h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="flex flex-col leading-tight">
                <span className="font-extrabold text-base sm:text-lg text-[#5d4037] tracking-tighter">같이n가치</span>
                <span className="text-[8px] sm:text-[10px] font-bold text-slate-400 tracking-[0.15em] sm:tracking-[0.2em] uppercase">Hospital Consulting</span>
              </div>
            </div>
          </div>
          <div className="text-right shrink-0">
            <div className="inline-flex flex-col sm:flex-row items-end sm:items-center sm:gap-1 text-[11px] sm:text-sm font-bold text-[#5d4037] bg-amber-50 px-2.5 sm:px-4 py-1.5 sm:py-1 rounded-xl sm:rounded-full border border-amber-100 leading-tight sm:leading-normal">
              <span className="whitespace-nowrap">같이n가치</span>
              <span className="whitespace-nowrap">병원컨설팅</span>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-3xl mx-auto px-4 pt-12 space-y-8">
        <div className="text-center space-y-2">
          <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">AI 리뷰 대응 스튜디오</h2>
          <p className="text-slate-500 font-medium">환자의 마음을 얻는 같이n가치만의 특별한 응대 전략</p>
        </div>

        <section className="bg-white rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-100 overflow-hidden transition-all hover:shadow-2xl hover:shadow-slate-200/60">
          <div className="p-8 space-y-8">
            <div className="space-y-6">
              <div className="flex items-center gap-3">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-amber-100 text-[#5d4037] text-xs font-bold">1</span>
                <h3 className="font-bold text-slate-800">치과 정보 및 응대 성향 설정</h3>
              </div>
              
              <div className="space-y-3">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider pl-1">치과명 (자동 저장됨)</h3>
                <input 
                  type="text"
                  value={hospitalName}
                  onChange={(e) => setHospitalName(e.target.value)}
                  placeholder="예: 같이가치치과"
                  className="w-full px-5 py-3 rounded-xl bg-slate-50 border-2 border-slate-100 focus:border-amber-400 focus:bg-white transition-all outline-none font-bold text-slate-700"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <SelectionGroup<ResponseType> 
                  label="리뷰 성격" 
                  options={Object.values(ResponseType) as ResponseType[]} 
                  selected={responseType} 
                  onChange={setResponseType} 
                />
                <SelectionGroup<ToneManner> 
                  label="대응 톤앤매너" 
                  options={Object.values(ToneManner) as ToneManner[]} 
                  selected={tone} 
                  onChange={setTone} 
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <SelectionGroup<Channel> 
                  label="게시 채널" 
                  options={Object.values(Channel) as Channel[]} 
                  selected={channel} 
                  onChange={setChannel} 
                />
                <SelectionGroup<EndingStyle> 
                  label="커뮤니케이션 톤 (종결 어미)" 
                  options={Object.values(EndingStyle) as EndingStyle[]} 
                  selected={endingStyle} 
                  onChange={setEndingStyle} 
                />
              </div>
            </div>

            <hr className="border-slate-100" />

            <div className="space-y-6">
              <div className="flex items-center gap-3">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-amber-100 text-[#5d4037] text-xs font-bold">2</span>
                <h3 className="font-bold text-slate-800">고객 리뷰 데이터</h3>
              </div>
              
              <div className="group relative">
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  onPaste={handlePaste}
                  placeholder="리뷰 내용을 입력하거나 사진을 복사해서 붙여넣어주세요..."
                  className="w-full min-h-[180px] p-6 rounded-2xl bg-slate-50 border-2 border-transparent focus:border-amber-400 focus:bg-white transition-all outline-none text-slate-700 leading-relaxed placeholder:text-slate-400"
                />
                
                <div className="absolute bottom-4 right-4 flex items-center gap-3">
                  {imagePreview && (
                    <div className="relative w-12 h-12 rounded-lg overflow-hidden border border-white shadow-md group/img">
                      <img src={imagePreview} className="w-full h-full object-cover" alt="Preview" />
                      <button 
                        onClick={removeImage}
                        className="absolute inset-0 bg-black/40 opacity-0 group-hover/img:opacity-100 flex items-center justify-center transition-opacity"
                      >
                        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12" strokeWidth="2.5" /></svg>
                      </button>
                    </div>
                  )}
                  <label className="cursor-pointer p-3 bg-white rounded-xl shadow-sm border border-slate-200 hover:border-amber-300 hover:text-[#5d4037] transition-all active:scale-95" title="이미지 업로드">
                    <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload} />
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </label>
                </div>
              </div>
              <p className="text-[11px] text-slate-400 text-center">이미지를 복사(Ctrl+C)한 후 위 입력창에 붙여넣기(Ctrl+V) 하셔도 첨부됩니다.</p>
              {imageCompressionInfo && (
                <p className="text-[11px] text-emerald-600 text-center font-bold">
                  이미지 자동 압축 완료: {formatFileSize(imageCompressionInfo.originalSize)} → {formatFileSize(imageCompressionInfo.compressedSize)}
                </p>
              )}
            </div>

            <button
              onClick={handleGenerate}
              disabled={loading}
              className={`w-full py-5 rounded-2xl font-bold text-lg flex items-center justify-center gap-3 transition-all transform active:scale-[0.99] ${
                loading 
                  ? 'bg-slate-100 text-slate-400 cursor-not-allowed' 
                  : 'bg-[#5d4037] text-white hover:bg-[#4e342e] shadow-xl shadow-amber-100'
              }`}
            >
              {loading ? (
                <>
                  <svg className="animate-spin h-6 w-6 text-slate-400" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  가치 있는 답변을 생성하고 있습니다...
                </>
              ) : (
                <>
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  분석 및 답변 생성
                </>
              )}
            </button>
          </div>
        </section>

        {result && (
          <section className="animate-in fade-in slide-in-from-bottom-8 duration-700 space-y-6">
            <div className="flex items-center justify-between px-2">
              <div className="flex flex-col">
                <h3 className="text-xl font-bold text-slate-800">분석 결과 및 제안 답변</h3>
                <span className="text-xs text-slate-400 font-medium">헤드라인이 포함된 전체 답변입니다.</span>
              </div>
              <button 
                onClick={copyToClipboard}
                className="px-4 py-2 bg-white rounded-xl border border-slate-200 text-sm font-bold text-slate-600 hover:bg-slate-50 hover:text-[#5d4037] transition-all flex items-center gap-2 active:scale-95"
              >
                {copyStatus === '복사 완료' ? (
                  <svg className="w-4 h-4 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" /></svg>
                )}
                {copyStatus}
              </button>
            </div>

            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-8 space-y-8">
              <div className={`rounded-2xl border p-5 ${
                riskMatches.length > 0
                  ? 'bg-rose-50 border-rose-200'
                  : 'bg-emerald-50 border-emerald-200'
              }`}>
                <div className="flex items-start gap-3">
                  <div className={`shrink-0 mt-0.5 rounded-full p-1 ${
                    riskMatches.length > 0 ? 'bg-rose-600' : 'bg-emerald-600'
                  }`}>
                    {riskMatches.length > 0 ? (
                      <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                  <div className="min-w-0 flex-1 space-y-3">
                    <div>
                      <h4 className={`text-sm font-extrabold ${
                        riskMatches.length > 0 ? 'text-rose-800' : 'text-emerald-800'
                      }`}>
                        {riskMatches.length > 0 ? `위험 표현 ${riskMatches.length}개 감지` : '위험 표현 미검출'}
                      </h4>
                      <p className={`mt-1 text-xs leading-relaxed ${
                        riskMatches.length > 0 ? 'text-rose-700' : 'text-emerald-700'
                      }`}>
                        {riskMatches.length > 0
                          ? '게시 전 아래 표현을 의료광고·과장 표현 관점에서 수정하거나 의료진 검수를 거쳐주세요.'
                          : '기본 위험 문구 목록에서는 감지된 표현이 없습니다. 게시 전 최종 의료진 검수는 필요합니다.'}
                      </p>
                    </div>

                    {riskMatches.length > 0 && (
                      <div className="space-y-2">
                        {riskMatches.map((risk) => (
                          <div key={risk.phrase} className="rounded-xl bg-white/80 border border-rose-100 p-3">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[11px] font-bold text-rose-700">
                                {risk.category}
                              </span>
                              <span className="text-sm font-extrabold text-slate-800">"{risk.phrase}"</span>
                            </div>
                            <p className="mt-1 text-xs leading-relaxed text-slate-600">{risk.guidance}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <span className="text-xs font-bold text-amber-600 uppercase tracking-widest">대응 답변 본문 (헤드라인 포함)</span>
                <div className="p-6 rounded-2xl bg-amber-50/20 text-slate-700 leading-relaxed whitespace-pre-wrap border border-amber-100/30 text-lg">
                  {result.body}
                </div>
              </div>

              <div className="flex items-start gap-4 p-5 rounded-2xl bg-slate-50 border border-slate-200">
                <div className="shrink-0 mt-1 p-1 bg-[#5d4037] rounded-full">
                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="space-y-1">
                  <h5 className="text-sm font-bold text-[#5d4037]">전략적 제언</h5>
                  <p className="text-sm text-slate-600 leading-normal">{result.caution}</p>
                </div>
              </div>
            </div>
          </section>
        )}

        <footer className="pt-20 pb-10 text-center space-y-6">
          <div className="space-y-2">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">CREATED BY</p>
            <p className="text-lg font-bold text-[#5d4037]">같이n가치 병원컨설팅</p>
          </div>
          
          <div className="w-12 h-[1px] bg-slate-200 mx-auto"></div>

          <div className="space-y-2">
            <p className="text-xs font-medium text-slate-500">
              © 2025 withvalue consulting, All rights reserved.
            </p>
            <p className="text-[11px] text-slate-400 leading-relaxed max-w-lg mx-auto px-4">
              본 리뷰는 AI 기반 초안을 활용하여 작성되었으며, 모든 내용은 의료진의 최종 검수 및 판단을 거쳐 게시되었습니다. 이에 따른 모든 책임은 최종 검수한 의료진에게 있습니다.
            </p>
          </div>
        </footer>
      </main>
    </div>
  );
}
