package com.nurseshift.app;

import android.app.Activity;
import android.app.KeyguardManager;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.os.Build;
import android.os.Bundle;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.WindowManager;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.TextView;
import androidx.core.content.ContextCompat;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

/** 잠금 화면 위에 뜨는 알람 화면: 큰 시계 + 근무 + [5분 뒤 다시] [끄기] */
public class ShiftAlarmActivity extends Activity {
    static final String ACTION_CLOSE = "com.nurseshift.app.ALARM_SCREEN_CLOSE";

    private final BroadcastReceiver closer = new BroadcastReceiver() {
        @Override
        public void onReceive(Context c, Intent i) {
            finish();
        }
    };

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        if (Build.VERSION.SDK_INT >= 27) {
            setShowWhenLocked(true);
            setTurnScreenOn(true);
            KeyguardManager km = (KeyguardManager) getSystemService(Context.KEYGUARD_SERVICE);
            if (km != null) km.requestDismissKeyguard(this, null);
        } else {
            getWindow().addFlags(
                WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED
                    | WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON
                    | WindowManager.LayoutParams.FLAG_DISMISS_KEYGUARD
            );
        }
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);

        String title = getIntent().getStringExtra(ShiftAlarmScheduler.EXTRA_TITLE);
        String body = getIntent().getStringExtra(ShiftAlarmScheduler.EXTRA_BODY);

        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setGravity(Gravity.CENTER);
        root.setBackgroundColor(Color.parseColor("#2563EB"));
        int pad = dp(28);
        root.setPadding(pad, pad, pad, pad);

        root.addView(text(new SimpleDateFormat("HH:mm", Locale.KOREA).format(new Date()), 72, true, "#FFFFFF"));
        root.addView(text(title == null ? "근무 알람" : title, 24, true, "#FFFFFF"));
        if (body != null && !body.isEmpty()) root.addView(text(body, 16, false, "#DBEAFE"));

        LinearLayout row = new LinearLayout(this);
        row.setOrientation(LinearLayout.HORIZONTAL);
        LinearLayout.LayoutParams rowLp = new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, dp(64));
        rowLp.topMargin = dp(48);
        row.setLayoutParams(rowLp);
        row.addView(button("5분 뒤 다시", "#1D4ED8", "#FFFFFF", ShiftAlarmService.ACTION_SNOOZE));
        row.addView(button("끄기", "#FFFFFF", "#1D4ED8", ShiftAlarmService.ACTION_DISMISS));
        root.addView(row);
        setContentView(root);

        ContextCompat.registerReceiver(this, closer, new IntentFilter(ACTION_CLOSE), ContextCompat.RECEIVER_NOT_EXPORTED);
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (!ShiftAlarmService.ringing) finish(); // 알림에서 이미 끈 경우
    }

    @Override
    protected void onDestroy() {
        try {
            unregisterReceiver(closer);
        } catch (Exception ignored) {
        }
        super.onDestroy();
    }

    @Override
    public void onBackPressed() {
        // 뒤로가기로 실수로 닫히지 않게 (끄기·5분 뒤 버튼으로만)
    }

    private TextView text(String s, int sp, boolean bold, String color) {
        TextView t = new TextView(this);
        t.setText(s);
        t.setTextSize(TypedValue.COMPLEX_UNIT_SP, sp);
        t.setTextColor(Color.parseColor(color));
        t.setGravity(Gravity.CENTER);
        if (bold) t.setTypeface(Typeface.DEFAULT_BOLD);
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT);
        lp.topMargin = dp(8);
        t.setLayoutParams(lp);
        return t;
    }

    private Button button(String label, String bg, String fg, String action) {
        Button b = new Button(this);
        b.setText(label);
        b.setAllCaps(false);
        b.setTextSize(TypedValue.COMPLEX_UNIT_SP, 18);
        b.setTypeface(Typeface.DEFAULT_BOLD);
        b.setTextColor(Color.parseColor(fg));
        GradientDrawable shape = new GradientDrawable();
        shape.setColor(Color.parseColor(bg));
        shape.setCornerRadius(dp(18));
        b.setBackground(shape);
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.MATCH_PARENT, 1f);
        lp.leftMargin = dp(6);
        lp.rightMargin = dp(6);
        b.setLayoutParams(lp);
        b.setOnClickListener(v -> {
            startService(new Intent(this, ShiftAlarmService.class).setAction(action));
            finish();
        });
        return b;
    }

    private int dp(int v) {
        return Math.round(TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, v, getResources().getDisplayMetrics()));
    }
}
