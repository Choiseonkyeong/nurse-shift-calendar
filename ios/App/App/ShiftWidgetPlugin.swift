import Capacitor
import WidgetKit

/// 웹(React) → 홈 화면 위젯: 앞으로 며칠간의 근무 JSON 을 App Group 에 저장하고 위젯 갱신
@objc(ShiftWidgetPlugin)
public class ShiftWidgetPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "ShiftWidgetPlugin"
    public let jsName = "ShiftWidget"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "update", returnType: CAPPluginReturnPromise)
    ]

    static let appGroup = "group.com.nurseshift.app"
    static let dataKey = "shift_widget_data"

    @objc func update(_ call: CAPPluginCall) {
        guard let data = call.getString("data") else {
            call.reject("data is required")
            return
        }
        UserDefaults(suiteName: ShiftWidgetPlugin.appGroup)?.set(data, forKey: ShiftWidgetPlugin.dataKey)
        WidgetCenter.shared.reloadAllTimelines()
        call.resolve(["ok": true])
    }
}

/// 앱 전용(로컬) 플러그인 등록
class MainViewController: CAPBridgeViewController {
    override func capacitorDidLoad() {
        bridge?.registerPluginInstance(ShiftWidgetPlugin())
    }
}
