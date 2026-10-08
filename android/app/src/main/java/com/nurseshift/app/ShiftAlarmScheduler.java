package com.nurseshift.app;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;
import org.json.JSONArray;
import org.json.JSONObject;

/**
 * 근무 알람 예약 (알람시계처럼 울림)
 * - 예약 목록은 SharedPreferences 에 저장 → 재부팅·앱 업데이트 후 BootReceiver 가 다시 예약
 * - '정확한 알람' 권한이 있으면 setAlarmClock (상태바 알람 아이콘, 절전 모드에서도 정시), 없으면 조금 늦을 수 있는 예약
 */
public final class ShiftAlarmScheduler {
    static final String PREFS = "shift_alarm";
    static final String KEY_ALARMS = "alarms";
    static final String EXTRA_ID = "alarm_id";
    static final String EXTRA_TITLE = "alarm_title";
    static final String EXTRA_BODY = "alarm_body";
    static final int SNOOZE_ID = 999_000_001;
    static final int SNOOZE_MINUTES = 5;

    private ShiftAlarmScheduler() {}

    /** 이전 예약을 모두 지우고 새 목록으로 예약. 반환: 예약한 개수 */
    public static int scheduleAll(Context ctx, JSONArray alarms) {
        cancelStored(ctx);
        prefs(ctx).edit().putString(KEY_ALARMS, alarms.toString()).apply();
        return scheduleStored(ctx);
    }

    /** 저장된 목록 중 앞으로 올 알람만 예약 (재부팅 후에도 사용) */
    public static int scheduleStored(Context ctx) {
        JSONArray list = stored(ctx);
        long now = System.currentTimeMillis();
        int count = 0;
        for (int i = 0; i < list.length(); i++) {
            JSONObject a = list.optJSONObject(i);
            if (a == null) continue;
            long at = a.optLong("at");
            if (at <= now) continue;
            setOne(ctx, a.optInt("id"), at, a.optString("title"), a.optString("body"));
            count++;
        }
        return count;
    }

    public static void cancelAll(Context ctx) {
        cancelStored(ctx);
        cancel(ctx, SNOOZE_ID);
        prefs(ctx).edit().remove(KEY_ALARMS).apply();
    }

    public static boolean canScheduleExact(Context ctx) {
        if (Build.VERSION.SDK_INT < 31) return true;
        AlarmManager am = (AlarmManager) ctx.getSystemService(Context.ALARM_SERVICE);
        return am != null && am.canScheduleExactAlarms();
    }

    static void setOne(Context ctx, int id, long at, String title, String body) {
        AlarmManager am = (AlarmManager) ctx.getSystemService(Context.ALARM_SERVICE);
        if (am == null) return;
        PendingIntent fire = firePending(ctx, id, title, body);
        if (canScheduleExact(ctx)) {
            Intent open = new Intent(ctx, MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            PendingIntent show = PendingIntent.getActivity(ctx, id, open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
            am.setAlarmClock(new AlarmManager.AlarmClockInfo(at, show), fire);
        } else {
            am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, fire);
        }
    }

    static void cancel(Context ctx, int id) {
        AlarmManager am = (AlarmManager) ctx.getSystemService(Context.ALARM_SERVICE);
        if (am != null) am.cancel(firePending(ctx, id, null, null));
    }

    private static PendingIntent firePending(Context ctx, int id, String title, String body) {
        Intent i = new Intent(ctx, ShiftAlarmReceiver.class)
            .setAction("com.nurseshift.app.ALARM_" + id)
            .putExtra(EXTRA_ID, id)
            .putExtra(EXTRA_TITLE, title)
            .putExtra(EXTRA_BODY, body);
        return PendingIntent.getBroadcast(ctx, id, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    private static void cancelStored(Context ctx) {
        JSONArray list = stored(ctx);
        for (int i = 0; i < list.length(); i++) {
            JSONObject a = list.optJSONObject(i);
            if (a != null) cancel(ctx, a.optInt("id"));
        }
    }

    private static JSONArray stored(Context ctx) {
        try {
            return new JSONArray(prefs(ctx).getString(KEY_ALARMS, "[]"));
        } catch (Exception e) {
            return new JSONArray();
        }
    }

    private static SharedPreferences prefs(Context ctx) {
        return ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }
}
