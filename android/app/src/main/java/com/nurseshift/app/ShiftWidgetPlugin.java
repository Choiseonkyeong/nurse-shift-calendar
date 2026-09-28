package com.nurseshift.app;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/** 웹(React) → 홈 화면 위젯: 앞으로 며칠간의 근무 JSON 을 저장하고 위젯을 즉시 갱신 */
@CapacitorPlugin(name = "ShiftWidget")
public class ShiftWidgetPlugin extends Plugin {

    @PluginMethod
    public void update(PluginCall call) {
        String data = call.getString("data");
        if (data == null) {
            call.reject("data is required");
            return;
        }
        getContext()
            .getSharedPreferences(ShiftWidgetProvider.PREFS, android.content.Context.MODE_PRIVATE)
            .edit()
            .putString(ShiftWidgetProvider.KEY_DATA, data)
            .apply();
        ShiftWidgetProvider.refreshAll(getContext());
        JSObject ret = new JSObject();
        ret.put("ok", true);
        call.resolve(ret);
    }
}
