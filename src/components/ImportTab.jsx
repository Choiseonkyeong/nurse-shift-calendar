import React from 'react';
import { FileSpreadsheet, Camera, Image as ImageIcon, Smartphone, Loader2, Trash2 } from 'lucide-react';

export default function ImportTab({
  isParsingExcel,
  handleExcelFileUpload,
  isAnalyzingImage,
  handleImageFileUpload,
  handleIcsFileUpload,
  handleClearAllData
}) {
  return (
    <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 space-y-4">
      <h2 className="font-bold text-base flex items-center gap-2 text-slate-900">
        <FileSpreadsheet size={18} className="text-indigo-600" /> 스마트 근무표 & 캘린더 가져오기
      </h2>

      <div className="border-2 border-dashed border-emerald-200 bg-emerald-50/50 p-4 rounded-2xl text-center space-y-2">
        <div className="flex justify-center text-emerald-600">
          <FileSpreadsheet size={24} />
        </div>
        <div>
          <p className="text-xs font-bold text-emerald-900">엑셀 근무표 파일(.xlsx, .csv) 가져오기</p>
          <p className="text-[10px] text-slate-500 mt-0.5">병원에서 받은 엑셀 근무표 파일을 올려주세요.</p>
        </div>
        <label className="inline-flex items-center gap-1.5 cursor-pointer bg-emerald-600 text-white font-bold text-xs px-4 py-2 rounded-xl hover:bg-emerald-700 shadow-sm transition">
          {isParsingExcel ? <Loader2 size={14} className="animate-spin" /> : null}
          <span>{isParsingExcel ? '엑셀 분석 중...' : '엑셀 파일 선택'}</span>
          <input type="file" accept=".xlsx, .xls, .csv" onChange={handleExcelFileUpload} disabled={isParsingExcel} className="hidden" />
        </label>
      </div>

      <div className="border-2 border-dashed border-indigo-200 bg-indigo-50/50 p-4 rounded-2xl text-center space-y-2">
        <div className="flex justify-center text-indigo-600">
          <Camera size={24} />
        </div>
        <div>
          <p className="text-xs font-bold text-indigo-900">근무표 사진 / 카메라 촬영 인식</p>
          <p className="text-[10px] text-slate-500 mt-0.5">종이 근무표 사진을 찍거나 갤러리 이미지를 올려주세요.</p>
        </div>
        <div className="flex justify-center gap-2 pt-1">
          <label className="cursor-pointer bg-indigo-600 text-white font-bold text-xs px-3.5 py-2 rounded-xl hover:bg-indigo-700 shadow-sm transition flex items-center gap-1">
            {isAnalyzingImage ? <Loader2 size={14} className="animate-spin" /> : <ImageIcon size={14} />}
            <span>{isAnalyzingImage ? '글자 분석 중...' : '사진첩 선택'}</span>
            <input type="file" accept="image/*" onChange={handleImageFileUpload} disabled={isAnalyzingImage} className="hidden" />
          </label>
          <label className="cursor-pointer bg-slate-800 text-white font-bold text-xs px-3.5 py-2 rounded-xl hover:bg-slate-900 shadow-sm transition flex items-center gap-1">
            {isAnalyzingImage ? <Loader2 size={14} className="animate-spin" /> : <Camera size={14} />}
            <span>{isAnalyzingImage ? '촬영 분석 중...' : '촬영하기'}</span>
            <input type="file" accept="image/*" capture="environment" onChange={handleImageFileUpload} disabled={isAnalyzingImage} className="hidden" />
          </label>
        </div>
      </div>

      <div className="border-2 border-dashed border-sky-200 bg-sky-50/50 p-4 rounded-2xl text-center space-y-2">
        <div className="flex justify-center text-sky-600">
          <Smartphone size={24} />
        </div>
        <div>
          <p className="text-xs font-bold text-sky-900">휴대폰 기본 캘린더(.ics) 가져오기</p>
          <p className="text-[10px] text-slate-500 mt-0.5">가져온 개인 일정은 기본적으로 🔒 비공개 처리됩니다.</p>
        </div>
        <label className="inline-block cursor-pointer bg-sky-600 text-white font-bold text-xs px-4 py-2 rounded-xl hover:bg-sky-700 shadow-sm transition">
          폰 캘린더 파일(.ics) 선택
          <input type="file" accept=".ics" onChange={handleIcsFileUpload} className="hidden" />
        </label>
      </div>

      <div className="pt-2 border-t flex justify-center">
        <button 
          onClick={handleClearAllData}
          className="text-xs text-red-500 font-semibold hover:underline flex items-center gap-1 py-1"
        >
          <Trash2 size={13} />
          <span>앱 저장 데이터 전체 초기화 및 로그아웃</span>
        </button>
      </div>
    </div>
  );
}
