import SwiftUI
import WidgetKit

// 홈 화면 위젯: 오늘 / 내일 근무 (앱이 App Group 에 저장한 JSON 사용)
// {"days":{"2026-09-28":{"code":"D","label":"...","bg":"#FEF08A","fg":"#854D0E","time":"07:00-15:00"}}}

private let appGroup = "group.com.nurseshift.app"
private let dataKey = "shift_widget_data"

struct DayShift {
    let title: String
    let code: String
    let sub: String
    let bg: Color
    let fg: Color
}

struct ShiftEntry: TimelineEntry {
    let date: Date
    let days: [DayShift]
}

private extension Color {
    init(hex: String?, fallback: Color) {
        guard var s = hex?.trimmingCharacters(in: .whitespaces), s.hasPrefix("#") else {
            self = fallback
            return
        }
        s.removeFirst()
        guard s.count == 6, let v = UInt64(s, radix: 16) else {
            self = fallback
            return
        }
        self = Color(
            red: Double((v >> 16) & 0xFF) / 255,
            green: Double((v >> 8) & 0xFF) / 255,
            blue: Double(v & 0xFF) / 255
        )
    }
}

private func loadDays(now: Date) -> [DayShift] {
    var days: [String: [String: String]] = [:]
    if let raw = UserDefaults(suiteName: appGroup)?.string(forKey: dataKey),
       let json = try? JSONSerialization.jsonObject(with: Data(raw.utf8)) as? [String: Any],
       let d = json["days"] as? [String: [String: String]] {
        days = d
    }

    let cal = Calendar.current
    let keyFmt = DateFormatter()
    keyFmt.calendar = Calendar(identifier: .gregorian)
    keyFmt.locale = Locale(identifier: "en_US_POSIX")
    keyFmt.dateFormat = "yyyy-MM-dd"
    let titleFmt = DateFormatter()
    titleFmt.locale = Locale(identifier: "ko_KR")
    titleFmt.dateFormat = "M/d (E)"

    return [("오늘", 0), ("내일", 1)].map { label, offset in
        let date = cal.date(byAdding: .day, value: offset, to: now) ?? now
        let title = "\(label) \(titleFmt.string(from: date))"
        guard let day = days[keyFmt.string(from: date)], let code = day["code"], !code.isEmpty else {
            return DayShift(title: title, code: "-", sub: "근무 미입력", bg: Color(white: 0.95), fg: .gray)
        }
        let time = day["time"] ?? ""
        return DayShift(
            title: title,
            code: code,
            sub: time.isEmpty ? (day["label"] ?? "") : time,
            bg: Color(hex: day["bg"], fallback: Color(white: 0.95)),
            fg: Color(hex: day["fg"], fallback: .gray)
        )
    }
}

struct Provider: TimelineProvider {
    func placeholder(in context: Context) -> ShiftEntry {
        ShiftEntry(date: Date(), days: [
            DayShift(title: "오늘", code: "D", sub: "07:00-15:00", bg: .yellow.opacity(0.4), fg: .brown),
            DayShift(title: "내일", code: "N", sub: "22:00-07:00", bg: .blue.opacity(0.2), fg: .blue)
        ])
    }

    func getSnapshot(in context: Context, completion: @escaping (ShiftEntry) -> Void) {
        completion(ShiftEntry(date: Date(), days: loadDays(now: Date())))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<ShiftEntry>) -> Void) {
        let now = Date()
        // 자정이 지나면 오늘/내일이 바뀌도록 다음 자정 직후에 다시 그림
        let nextMidnight = Calendar.current.date(byAdding: .minute, value: 1, to: Calendar.current.startOfDay(for: now.addingTimeInterval(86400))) ?? now.addingTimeInterval(3600)
        completion(Timeline(entries: [ShiftEntry(date: now, days: loadDays(now: now))], policy: .after(nextMidnight)))
    }
}

struct DayView: View {
    let day: DayShift
    let primary: Bool

    var body: some View {
        VStack(spacing: 4) {
            Text(day.title)
                .font(.system(size: 11, weight: .bold))
                .foregroundColor(primary ? Color(red: 0.31, green: 0.27, blue: 0.9) : .gray)
                .lineLimit(1)
            Text(day.code)
                .font(.system(size: 22, weight: .black))
                .foregroundColor(day.fg)
                .lineLimit(1)
                .minimumScaleFactor(0.5)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 6)
                .background(RoundedRectangle(cornerRadius: 12).fill(day.bg))
            Text(day.sub)
                .font(.system(size: 10, weight: .semibold))
                .foregroundColor(.gray)
                .lineLimit(1)
        }
    }
}

struct ShiftWidgetView: View {
    @Environment(\.widgetFamily) var family
    let entry: ShiftEntry

    var body: some View {
        Group {
            if family == .systemSmall {
                VStack(spacing: 8) {
                    DayView(day: entry.days[0], primary: true)
                    HStack {
                        Text(entry.days[1].title).font(.system(size: 10, weight: .bold)).foregroundColor(.gray).lineLimit(1)
                        Spacer()
                        Text(entry.days[1].code).font(.system(size: 13, weight: .black)).foregroundColor(entry.days[1].fg)
                    }
                }
            } else {
                HStack(spacing: 12) {
                    DayView(day: entry.days[0], primary: true)
                    DayView(day: entry.days[1], primary: false)
                }
            }
        }
        .padding(4)
        .widgetBackground()
    }
}

private extension View {
    @ViewBuilder
    func widgetBackground() -> some View {
        if #available(iOSApplicationExtension 17.0, *) {
            containerBackground(Color.white, for: .widget)
        } else {
            background(Color.white)
        }
    }
}

@main
struct ShiftWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "ShiftWidget", provider: Provider()) { entry in
            ShiftWidgetView(entry: entry)
        }
        .configurationDisplayName("오늘·내일 근무")
        .description("오늘과 내일 근무를 홈 화면에서 바로 확인하세요.")
        .supportedFamilies([.systemSmall, .systemMedium])
    }
}
