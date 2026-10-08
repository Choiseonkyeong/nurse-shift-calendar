import Capacitor
import Foundation
import UIKit
#if canImport(AlarmKit)
import AlarmKit
import SwiftUI
#endif

/// 웹(React) → 근무 알람 (아이폰 iOS 26 이상: AlarmKit — 무음 모드·집중 모드에서도 알람처럼 울림)
/// iOS 26 미만에서는 supported: false 를 돌려주고, 앱은 기존 알림으로 대신함
@objc(ShiftAlarmPlugin)
public class ShiftAlarmPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "ShiftAlarmPlugin"
    public let jsName = "ShiftAlarm"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "schedule", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "cancelAll", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "status", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "openSettings", returnType: CAPPluginReturnPromise)
    ]

    @objc func schedule(_ call: CAPPluginCall) {
        let raw = call.getArray("alarms", JSObject.self) ?? []
        #if canImport(AlarmKit)
        if #available(iOS 26.0, *) {
            Task {
                do {
                    let count = try await ShiftAlarmKit.schedule(raw)
                    call.resolve(["supported": true, "authorized": true, "count": count])
                } catch ShiftAlarmKit.Failure.notAuthorized {
                    call.resolve(["supported": true, "authorized": false, "count": 0])
                } catch {
                    call.reject("알람 예약 실패: \(error.localizedDescription)")
                }
            }
            return
        }
        #endif
        call.resolve(["supported": false, "authorized": false, "count": 0])
    }

    @objc func cancelAll(_ call: CAPPluginCall) {
        #if canImport(AlarmKit)
        if #available(iOS 26.0, *) {
            ShiftAlarmKit.cancelAll()
        }
        #endif
        call.resolve()
    }

    @objc func status(_ call: CAPPluginCall) {
        #if canImport(AlarmKit)
        if #available(iOS 26.0, *) {
            call.resolve(["supported": true, "authorized": ShiftAlarmKit.isAuthorized, "exact": true, "fullScreen": true])
            return
        }
        #endif
        call.resolve(["supported": false, "authorized": false, "exact": false, "fullScreen": false])
    }

    @objc func openSettings(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            if let url = URL(string: UIApplication.openSettingsURLString) {
                UIApplication.shared.open(url)
            }
            call.resolve()
        }
    }
}

#if canImport(AlarmKit)
@available(iOS 26.0, *)
struct ShiftAlarmMetadata: AlarmMetadata {}

@available(iOS 26.0, *)
enum ShiftAlarmKit {
    enum Failure: Error { case notAuthorized }

    static var isAuthorized: Bool {
        AlarmManager.shared.authorizationState == .authorized
    }

    /// 이전 알람은 모두 지우고 새로 예약
    static func schedule(_ raw: [JSObject]) async throws -> Int {
        let manager = AlarmManager.shared
        if manager.authorizationState == .notDetermined {
            _ = try await manager.requestAuthorization()
        }
        guard manager.authorizationState == .authorized else { throw Failure.notAuthorized }

        cancelAll()
        let now = Date()
        var count = 0
        for item in raw {
            guard let atMs = (item["at"] as? NSNumber)?.doubleValue else { continue }
            let date = Date(timeIntervalSince1970: atMs / 1000)
            if date <= now { continue }
            let title = (item["title"] as? String) ?? "근무 알람"
            let alert = AlarmPresentation.Alert(
                title: LocalizedStringResource(String.LocalizationValue(title)),
                stopButton: AlarmButton(text: "끄기", textColor: .white, systemImageName: "stop.circle")
            )
            let attributes = AlarmAttributes<ShiftAlarmMetadata>(
                presentation: AlarmPresentation(alert: alert),
                metadata: ShiftAlarmMetadata(),
                tintColor: Color(red: 0.145, green: 0.388, blue: 0.922)
            )
            let configuration = AlarmManager.AlarmConfiguration<ShiftAlarmMetadata>(
                schedule: .fixed(date),
                attributes: attributes
            )
            _ = try await manager.schedule(id: UUID(), configuration: configuration)
            count += 1
        }
        return count
    }

    static func cancelAll() {
        let manager = AlarmManager.shared
        guard let alarms = try? manager.alarms else { return }
        for alarm in alarms {
            try? manager.cancel(id: alarm.id)
        }
    }
}
#endif
