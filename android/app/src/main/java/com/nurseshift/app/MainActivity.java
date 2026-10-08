package com.nurseshift.app;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // 홈 화면 위젯 데이터 전달용 로컬 플러그인
        registerPlugin(ShiftWidgetPlugin.class);
        // 근무 알람(알람시계처럼 울림)
        registerPlugin(ShiftAlarmPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
