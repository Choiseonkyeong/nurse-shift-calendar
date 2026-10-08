package com.nurseshift.app;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import androidx.core.content.ContextCompat;

/** 예약 시각이 되면 알람을 울리는 서비스를 시작 */
public class ShiftAlarmReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context ctx, Intent intent) {
        Intent ring = new Intent(ctx, ShiftAlarmService.class)
            .setAction(ShiftAlarmService.ACTION_RING)
            .putExtras(intent);
        ContextCompat.startForegroundService(ctx, ring);
    }
}
