
import React, { useState, useEffect } from 'react';
import { SelectionGroup } from './components/SelectionGroup';
import { ResponseType, Channel, ToneManner, EndingStyle, GenerationResult, RequestConfig } from './types';
import { generateReviewResponse } from './geminiService';

const MAX_IMAGE_SIZE_MB = 5;
const MAX_IMAGE_SIZE_BYTES = MAX_IMAGE_SIZE_MB * 1024 * 1024;

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
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<GenerationResult | null>(null);
  const [copyStatus, setCopyStatus] = useState('복사하기');

  useEffect(() => {
    localStorage.setItem('hospital_name', hospitalName);
  }, [hospitalName]);

  const processFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      alert('이미지 파일만 첨부할 수 있습니다.');
      return;
    }

    if (file.size > MAX_IMAGE_SIZE_BYTES) {
      alert(`이미지는 ${MAX_IMAGE_SIZE_MB}MB 이하만 첨부할 수 있습니다.`);
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      const fullBase64 = reader.result as string;
      setImagePreview(fullBase64);
      setImageData(fullBase64.split(',')[1]);
      setImageMimeType(file.type);
    };
    reader.readAsDataURL(file);
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
