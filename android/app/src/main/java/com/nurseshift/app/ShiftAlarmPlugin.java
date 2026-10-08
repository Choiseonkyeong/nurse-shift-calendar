package com.nurseshift.app;

import android.app.NotificationManager;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import org.json.JSONArray;
import org.json.JSONObject;

/** 웹(React) → 근무 알람(알람시계처럼 울림) 예약·취소·상태 */
@CapacitorPlugin(name = "ShiftAlarm")
public class ShiftAlarmPlugin extends Plugin {

    /** alarms: [{ id, at(ms), title, body }] — 이전 예약은 모두 지우고 새로 예약 */
    @PluginMethod
    public void schedule(PluginCall call) {
        JSArray alarms = call.getArray("alarms", new JSArray());
        JSONArray clean = new JSONArray();
        try {
            for (int i = 0; i < alarms.length(); i++) {
                JSONObject a = alarms.getJSONObject(i);
                JSONObject o = new JSONObject();
                o.put("id", a.getInt("id"));
                o.put("at", a.getLong("at"));
                o.put("title", a.optString("title"));
                o.put("body", a.optString("body"));
                clean.put(o);
            }
        } catch (Exception e) {
            call.reject("잘못된 알람 목록: " + e.getMessage());
            return;
        }
        int count = ShiftAlarmScheduler.scheduleAll(getContext(), clean);
        JSObject ret = status(getContext());
        ret.put("count", count);
        call.resolve(ret);
    }

    @PluginMethod
    public void cancelAll(PluginCall call) {
        ShiftAlarmScheduler.cancelAll(getContext());
        call.resolve();
    }

    @PluginMethod
    public void status(PluginCall call) {
        call.resolve(status(getContext()));
    }

    /** 정확한 알람(시각 맞춤) 또는 전체 화면 알람 허용 화면 열기 */
    @PluginMethod
    public void openSettings(PluginCall call) {
        Context ctx = getContext();
        Uri pkg = Uri.parse("package:" + ctx.getPackageName());
        Intent i;
        if (Build.VERSION.SDK_INT >= 31 && !ShiftAlarmScheduler.canScheduleExact(ctx)) {
            i = new Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM, pkg);
        } else if (Build.VERSION.SDK_INT >= 34 && !canFullScreen(ctx)) {
            i = new Intent(Settings.ACTION_MANAGE_APP_USE_FULL_SCREEN_INTENT, pkg);
        } else {
            i = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, pkg);
        }
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        try {
            ctx.startActivity(i);
        } catch (Exception e) {
            ctx.startActivity(new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, pkg).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
        }
        call.resolve();
    }

    private static JSObject status(Context ctx) {
        JSObject ret = new JSObject();
        ret.put("supported", true);
        ret.put("exact", ShiftAlarmScheduler.canScheduleExact(ctx));
        ret.put("fullScreen", canFullScreen(ctx));
        return ret;
    }

    private static boolean canFullScreen(Context ctx) {
        if (Build.VERSION.SDK_INT < 34) return true;
        NotificationManager nm = (NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE);
        return nm != null && nm.canUseFullScreenIntent();
    }
}
