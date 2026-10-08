package com.nurseshift.app;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/** 재부팅·앱 업데이트·시간 변경 후 저장된 근무 알람을 다시 예약 (안드로이드는 재부팅하면 예약이 사라짐) */
public class ShiftAlarmBootReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context ctx, Intent intent) {
        ShiftAlarmScheduler.scheduleStored(ctx);
    }
}
