// 1. import 구문에 splitDateKey 추가
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { 
  Users, PlusCircle, UserCheck, Palette, RefreshCw, ChevronLeft, ChevronRight, ArrowLeft
} from 'lucide-react';
import { supabase } from '../supabaseClient';
import { toDateKey, cleanDisplayName, isSamePerson, splitDateKey } from '../utils/dateUtils';

// ... (기존 컴포넌트 선언 및 변수 동일) ...

export default function GroupShareTab({
  // ... props
}) {
  // ... (기존 state들)

  const normalizedSelectedDate = useMemo(() => toDateKey(selectedDate), [selectedDate]);

  const [groupYear, setGroupYear] = useState(() => Number(normalizedSelectedDate?.split('-')[0]) || 2026);
  const [groupMonth, setGroupMonth] = useState(() => Number(normalizedSelectedDate?.split('-')[1]) || 9);

  // 💡 [추가] selectedDate가 변경되면 그룹 달력의 연도/월도 자동으로 동기화
  useEffect(() => {
    const { year, month } = splitDateKey(normalizedSelectedDate);
    if (year && month) {
      setGroupYear(year);
      setGroupMonth(month);
    }
  }, [normalizedSelectedDate]);

  // ... (이하 기존 코드 동일)
