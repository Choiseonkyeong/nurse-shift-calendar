package com.nurseshift.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.media.AudioAttributes;
import android.media.MediaPlayer;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.os.VibratorManager;
import androidx.core.app.NotificationCompat;
import androidx.core.app.ServiceCompat;

/**
 * 알람 울리기: 알람 볼륨(USAGE_ALARM)으로 반복 재생 + 진동 → 무음·진동 모드에서도 울림
 * 끄기 / 5분 뒤 다시 버튼 (알림·잠금 화면 알람 창), 아무것도 안 누르면 3분 뒤 자동으로 멈춤
 */
public class ShiftAlarmService extends Service {
    static final String ACTION_RING = "com.nurseshift.app.ALARM_RING";
    static final String ACTION_DISMISS = "com.nurseshift.app.ALARM_DISMISS";
    static final String ACTION_SNOOZE = "com.nurseshift.app.ALARM_SNOOZE";
    static final String CHANNEL_ID = "shift-alarm";
    static final int NOTIFICATION_ID = 7301;
    private static final long AUTO_STOP_MS = 3 * 60 * 1000;

    static volatile boolean ringing = false;

    private MediaPlayer player;
    private Vibrator vibrator;
    private final Handler handler = new Handler(Looper.getMainLooper());
    private String title = "";
    private String body = "";

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        String action = intent != null ? intent.getAction() : null;
        if (ACTION_SNOOZE.equals(action)) {
            long at = System.currentTimeMillis() + ShiftAlarmScheduler.SNOOZE_MINUTES * 60_000L;
            ShiftAlarmScheduler.setOne(this, ShiftAlarmScheduler.SNOOZE_ID, at, title, body);
            stopAlarm();
            return START_NOT_STICKY;
        }
        if (ACTION_DISMISS.equals(action) || intent == null) {
            stopAlarm();
            return START_NOT_STICKY;
        }
        // 울리기
        title = nonEmpty(intent.getStringExtra(ShiftAlarmScheduler.EXTRA_TITLE), "근무 알람");
        body = nonEmpty(intent.getStringExtra(ShiftAlarmScheduler.EXTRA_BODY), "");
        startInForeground();
        startSound();
        startVibration();
        ringing = true;
        handler.removeCallbacksAndMessages(null);
        handler.postDelayed(this::stopAlarm, AUTO_STOP_MS);
        return START_NOT_STICKY;
    }

    private void startInForeground() {
        NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (Build.VERSION.SDK_INT >= 26 && nm != null && nm.getNotificationChannel(CHANNEL_ID) == null) {
            NotificationChannel ch = new NotificationChannel(CHANNEL_ID, "근무 알람", NotificationManager.IMPORTANCE_HIGH);
            ch.setDescription("근무 시작 전 알람시계처럼 울립니다.");
            ch.setSound(null, null); // 소리는 서비스가 알람 볼륨으로 직접 재생
            ch.enableVibration(false);
            ch.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
            nm.createNotificationChannel(ch);
        }
        Intent screen = new Intent(this, ShiftAlarmActivity.class)
            .putExtra(ShiftAlarmScheduler.EXTRA_TITLE, title)
            .putExtra(ShiftAlarmScheduler.EXTRA_BODY, body)
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_NO_USER_ACTION);
        PendingIntent screenPi = PendingIntent.getActivity(this, 1, screen, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        Notification n = new NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_stat_shift)
            .setContentTitle(title)
            .setContentText(body)
            .setCategory(NotificationCompat.CATEGORY_ALARM)
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setOngoing(true)
            .setAutoCancel(false)
            .setContentIntent(screenPi)
            .setFullScreenIntent(screenPi, true)
            .addAction(0, "5분 뒤 다시", servicePending(ACTION_SNOOZE, 2))
            .addAction(0, "끄기", servicePending(ACTION_DISMISS, 3))
            .build();
        int type = Build.VERSION.SDK_INT >= 29 ? ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK : 0;
        ServiceCompat.startForeground(this, NOTIFICATION_ID, n, type);
    }

    private PendingIntent servicePending(String action, int requestCode) {
        Intent i = new Intent(this, ShiftAlarmService.class).setAction(action);
        return PendingIntent.getService(this, requestCode, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    private void startSound() {
        stopSound();
        Uri uri = RingtoneManager.getActualDefaultRingtoneUri(this, RingtoneManager.TYPE_ALARM);
        if (uri == null) uri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM);
        if (uri == null) uri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE);
        try {
            player = new MediaPlayer();
            player.setAudioAttributes(
                new AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_ALARM)
                    .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                    .build()
            );
            player.setDataSource(this, uri);
            player.setLooping(true);
            player.prepare();
            player.start();
        } catch (Exception e) {
            stopSound();
        }
    }

    private void startVibration() {
        if (Build.VERSION.SDK_INT >= 31) {
            VibratorManager vm = (VibratorManager) getSystemService(Context.VIBRATOR_MANAGER_SERVICE);
            vibrator = vm != null ? vm.getDefaultVibrator() : null;
        } else {
            vibrator = (Vibrator) getSystemService(Context.VIBRATOR_SERVICE);
        }
        if (vibrator == null || !vibrator.hasVibrator()) return;
        long[] pattern = { 0, 800, 600 };
        if (Build.VERSION.SDK_INT >= 26) vibrator.vibrate(VibrationEffect.createWaveform(pattern, 0));
        else vibrator.vibrate(pattern, 0);
    }

    private void stopSound() {
        if (player != null) {
            try {
                player.stop();
            } catch (Exception ignored) {
            }
            player.release();
            player = null;
        }
    }

    private void stopAlarm() {
        ringing = false;
        handler.removeCallbacksAndMessages(null);
        stopSound();
        if (vibrator != null) vibrator.cancel();
        ServiceCompat.stopForeground(this, ServiceCompat.STOP_FOREGROUND_REMOVE);
        stopSelf();
        sendBroadcast(new Intent(ShiftAlarmActivity.ACTION_CLOSE).setPackage(getPackageName()));
    }

    @Override
    public void onDestroy() {
        ringing = false;
        handler.removeCallbacksAndMessages(null);
        stopSound();
        if (vibrator != null) vibrator.cancel();
        super.onDestroy();
    }

    private static String nonEmpty(String s, String fallback) {
        return s == null || s.isEmpty() ? fallback : s;
    }
}
