package com.nurseshift.app;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.graphics.Color;
import android.widget.RemoteViews;
import java.text.SimpleDateFormat;
import java.util.Calendar;
import java.util.Locale;
import org.json.JSONObject;

/**
 * 홈 화면 위젯: 오늘 / 내일 근무.
 * 데이터: SharedPreferences(shift_widget).data = {"days":{"2026-09-28":{"code":"D","label":"...","bg":"#FEF08A","fg":"#854D0E","time":"07:00-15:00"}}}
 * 자정마다 스스로 갱신해 앱을 열지 않아도 날짜가 넘어감.
 */
public class ShiftWidgetProvider extends AppWidgetProvider {

    static final String PREFS = "shift_widget";
    static final String KEY_DATA = "data";
    private static final String ACTION_MIDNIGHT = "com.nurseshift.app.WIDGET_MIDNIGHT";
    private static final String[] DOW = { "일", "월", "화", "수", "목", "금", "토" };

    static void refreshAll(Context context) {
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        int[] ids = manager.getAppWidgetIds(new ComponentName(context, ShiftWidgetProvider.class));
        for (int id : ids) {
            manager.updateAppWidget(id, buildViews(context));
        }
        scheduleMidnight(context);
    }

    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] ids) {
        for (int id : ids) {
            manager.updateAppWidget(id, buildViews(context));
        }
        scheduleMidnight(context);
    }

    @Override
    public void onReceive(Context context, Intent intent) {
        super.onReceive(context, intent);
        String action = intent.getAction();
        if (ACTION_MIDNIGHT.equals(action)
            || Intent.ACTION_TIME_CHANGED.equals(action)
            || Intent.ACTION_TIMEZONE_CHANGED.equals(action)) {
            refreshAll(context);
        }
    }

    @Override
    public void onDisabled(Context context) {
        AlarmManager am = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        if (am != null) am.cancel(midnightIntent(context));
    }

    private static PendingIntent midnightIntent(Context context) {
        Intent intent = new Intent(context, ShiftWidgetProvider.class).setAction(ACTION_MIDNIGHT);
        return PendingIntent.getBroadcast(context, 0, intent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    /** 다음 자정(+1분)에 갱신. 정확한 알람 권한이 필요 없는 비정확 알람 사용 */
    private static void scheduleMidnight(Context context) {
        AlarmManager am = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        if (am == null) return;
        Calendar next = Calendar.getInstance();
        next.add(Calendar.DAY_OF_MONTH, 1);
        next.set(Calendar.HOUR_OF_DAY, 0);
        next.set(Calendar.MINUTE, 1);
        next.set(Calendar.SECOND, 0);
        am.set(AlarmManager.RTC, next.getTimeInMillis(), midnightIntent(context));
    }

    private static RemoteViews buildViews(Context context) {
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.shift_widget);
        JSONObject days = new JSONObject();
        try {
            String raw = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(KEY_DATA, null);
            if (raw != null) {
                JSONObject root = new JSONObject(raw);
                JSONObject d = root.optJSONObject("days");
                if (d != null) days = d;
            }
        } catch (Exception ignored) {
            // 손상된 데이터는 빈 위젯으로 표시
        }

        Calendar cal = Calendar.getInstance();
        fillDay(views, days, cal, "오늘", R.id.day1_title, R.id.day1_code, R.id.day1_time);
        cal.add(Calendar.DAY_OF_MONTH, 1);
        fillDay(views, days, cal, "내일", R.id.day2_title, R.id.day2_code, R.id.day2_time);

        Intent open = new Intent(context, MainActivity.class);
        open.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent pi = PendingIntent.getActivity(context, 0, open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        views.setOnClickPendingIntent(R.id.widget_root, pi);
        return views;
    }

    private static void fillDay(RemoteViews views, JSONObject days, Calendar cal, String label, int titleId, int codeId, int timeId) {
        String key = new SimpleDateFormat("yyyy-MM-dd", Locale.US).format(cal.getTime());
        String title = label + " " + (cal.get(Calendar.MONTH) + 1) + "/" + cal.get(Calendar.DAY_OF_MONTH) + " (" + DOW[cal.get(Calendar.DAY_OF_WEEK) - 1] + ")";
        views.setTextViewText(titleId, title);

        JSONObject day = days.optJSONObject(key);
        if (day == null) {
            views.setTextViewText(codeId, "-");
            views.setTextColor(codeId, Color.parseColor("#94A3B8"));
            views.setInt(codeId, "setBackgroundColor", Color.parseColor("#F1F5F9"));
            views.setTextViewText(timeId, "근무 미입력");
            return;
        }
        views.setTextViewText(codeId, day.optString("code", "-"));
        views.setTextColor(codeId, parseColor(day.optString("fg"), "#475569"));
        views.setInt(codeId, "setBackgroundColor", parseColor(day.optString("bg"), "#F1F5F9"));
        String time = day.optString("time", "");
        views.setTextViewText(timeId, time.isEmpty() ? day.optString("label", "") : time);
    }

    private static int parseColor(String value, String fallback) {
        try {
            return Color.parseColor(value);
        } catch (Exception e) {
            return Color.parseColor(fallback);
        }
    }
}
