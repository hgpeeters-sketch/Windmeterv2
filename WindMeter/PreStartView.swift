import SwiftUI

struct PreStartView: View {
    @ObservedObject var bluetooth: BluetoothManager
    @State private var unit: SpeedUnit = .knots
    @State private var timeString = ""

    private let clock = Timer.publish(every: 1, on: .main, in: .common).autoconnect()

    // Alternating: 0=dark, 1=light, 2=dark, 3=light, 4=dark
    private func bg(_ i: Int) -> Color { i.isMultiple(of: 2) ? .black : .white }
    private func fg(_ i: Int) -> Color { i.isMultiple(of: 2) ? .white : .black }

    var body: some View {
        VStack(spacing: 0) {

            // ── 0: Clock header  (dark) ─────────────────────────
            HStack {
                Text("PRE-START")
                    .font(.system(size: 11, weight: .bold, design: .monospaced))
                    .foregroundColor(fg(0).opacity(0.4))
                    .tracking(3)
                Spacer()
                Text(timeString)
                    .font(.system(size: 22, weight: .bold, design: .monospaced))
                    .foregroundColor(fg(0))
                    .monospacedDigit()
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 12)
            .frame(maxWidth: .infinity)
            .background(bg(0))

            // ── 1: TWD  (light) ─────────────────────────────────
            VStack(alignment: .leading, spacing: 0) {
                label("TWD", fg: fg(1))
                HStack(alignment: .lastTextBaseline, spacing: 12) {
                    Text("\(bluetooth.windData.windDirection)°")
                        .font(.system(size: 80, weight: .bold, design: .monospaced))
                        .foregroundColor(fg(1))
                        .contentTransition(.numericText())
                        .animation(.spring(response: 0.3), value: bluetooth.windData.windDirection)
                    Text(compassLabel(bluetooth.windData.windDirection))
                        .font(.system(size: 32, weight: .regular, design: .monospaced))
                        .foregroundColor(fg(1).opacity(0.4))
                }
                .padding(.leading, 16)
                .padding(.bottom, 14)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(bg(1))

            // ── 2: Oscillation chart  (dark) ────────────────────
            VStack(alignment: .leading, spacing: 6) {
                label("WIND SHIFT  (° FROM MEAN)", fg: fg(2))
                OscillationChart(samples: bluetooth.samples, foreground: fg(2))
                    .frame(height: 130)
                    .padding(.bottom, 10)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(bg(2))

            // ── 3: TWS  (light) ─────────────────────────────────
            VStack(alignment: .leading, spacing: 0) {
                HStack(alignment: .center) {
                    label("TWS", fg: fg(3))
                    Spacer()
                    Button { cycleUnit() } label: {
                        Text(unit.rawValue)
                            .font(.system(size: 11, weight: .bold, design: .monospaced))
                            .foregroundColor(fg(3).opacity(0.7))
                            .padding(.horizontal, 8).padding(.vertical, 4)
                            .overlay(RoundedRectangle(cornerRadius: 4)
                                .stroke(fg(3).opacity(0.28), lineWidth: 1))
                    }
                    .buttonStyle(.plain)
                    .padding(.trailing, 16)
                }
                HStack(alignment: .lastTextBaseline, spacing: 10) {
                    Text(String(format: "%.1f", unit.value(bluetooth.windData.windSpeed)))
                        .font(.system(size: 80, weight: .bold, design: .monospaced))
                        .foregroundColor(fg(3))
                        .contentTransition(.numericText())
                        .animation(.spring(response: 0.3), value: bluetooth.windData.windSpeed)
                    Text(unit.rawValue)
                        .font(.system(size: 28, weight: .regular, design: .monospaced))
                        .foregroundColor(fg(3).opacity(0.35))
                }
                .padding(.leading, 16)
                .padding(.bottom, 14)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(bg(3))

            // ── 4: Speed history  (dark) ────────────────────────
            VStack(alignment: .leading, spacing: 6) {
                label("WIND SPEED  (30 MIN, 3 MIN BARS)", fg: fg(4))
                SpeedHistoryChart(buckets: bluetooth.speedBuckets, unit: unit, foreground: fg(4))
                    .frame(height: 110)
                    .padding(.bottom, 10)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(bg(4))

            Spacer(minLength: 0).background(bg(4))
        }
        .onReceive(clock) { _ in
            let f = DateFormatter(); f.dateFormat = "HH:mm:ss"
            timeString = f.string(from: Date())
        }
        .onAppear {
            let f = DateFormatter(); f.dateFormat = "HH:mm:ss"
            timeString = f.string(from: Date())
        }
    }

    private func label(_ text: String, fg: Color) -> some View {
        Text(text)
            .font(.system(size: 10, weight: .medium, design: .monospaced))
            .foregroundColor(fg.opacity(0.35))
            .tracking(2)
            .padding(.leading, 16)
            .padding(.top, 10)
            .padding(.bottom, 4)
    }

    private func cycleUnit() {
        let all = SpeedUnit.allCases
        withAnimation { unit = all[(all.firstIndex(of: unit)! + 1) % all.count] }
    }

    private func compassLabel(_ deg: Int) -> String {
        let pts = ["N","NNE","NE","ENE","E","ESE","SE","SSE",
                   "S","SSW","SW","WSW","W","WNW","NW","NNW"]
        return pts[((deg + 11) / 22) % 16]
    }
}

// MARK: – Oscillation chart

struct OscillationChart: View {
    let samples: [BluetoothManager.WindSample]
    var foreground: Color = .white

    private var deviations: [Double] {
        let cutoff = Date().addingTimeInterval(-30 * 60)
        let dirs = samples.filter { $0.time >= cutoff }.map { Double($0.direction) }
        guard dirs.count > 1 else { return [] }
        let sinMean = dirs.map { sin($0 * .pi / 180) }.reduce(0, +) / Double(dirs.count)
        let cosMean = dirs.map { cos($0 * .pi / 180) }.reduce(0, +) / Double(dirs.count)
        let meanDeg = atan2(sinMean, cosMean) * 180 / .pi
        return dirs.map { d -> Double in
            var diff = d - meanDeg
            if diff >  180 { diff -= 360 }
            if diff < -180 { diff += 360 }
            return diff
        }
    }

    var body: some View {
        Canvas { ctx, size in
            let devs = deviations
            let midY  = size.height / 2
            let maxD  = max(10.0, devs.map { abs($0) }.max() ?? 10)
            let n     = max(devs.count, 1)

            for ratio in [0.5, 1.0] {
                let y = midY - CGFloat(ratio) * midY * 0.85
                var p = Path(); p.move(to: .init(x: 0, y: y)); p.addLine(to: .init(x: size.width, y: y))
                ctx.stroke(p, with: .color(foreground.opacity(0.08)), lineWidth: 1)
                var p2 = Path(); p2.move(to: .init(x: 0, y: size.height - y)); p2.addLine(to: .init(x: size.width, y: size.height - y))
                ctx.stroke(p2, with: .color(foreground.opacity(0.08)), lineWidth: 1)
            }

            var zl = Path()
            zl.move(to: .init(x: 0, y: midY))
            zl.addLine(to: .init(x: size.width, y: midY))
            ctx.stroke(zl, with: .color(foreground.opacity(0.35)), lineWidth: 1)

            guard !devs.isEmpty else { return }
            let gap: CGFloat = 1
            let barW = (size.width - gap * CGFloat(n - 1)) / CGFloat(n)

            for (i, dev) in devs.enumerated() {
                let barH = max(2, abs(CGFloat(dev)) / CGFloat(maxD) * (midY - 4))
                let x    = CGFloat(i) * (barW + gap)
                let y    = dev >= 0 ? midY - barH : midY
                let rect = CGRect(x: x, y: y, width: max(1, barW), height: barH)
                let opacity: Double = dev >= 0 ? 0.95 : 0.65
                ctx.fill(Path(rect), with: .color(foreground.opacity(opacity)))
            }
        }
        .overlay(alignment: .topLeading) {
            Text("+")
                .font(.system(size: 9, design: .monospaced))
                .foregroundColor(foreground.opacity(0.25))
                .padding(.leading, 4)
        }
        .overlay(alignment: .bottomLeading) {
            Text("−")
                .font(.system(size: 9, design: .monospaced))
                .foregroundColor(foreground.opacity(0.25))
                .padding(.leading, 4)
        }
    }
}

// MARK: – Speed history chart

struct SpeedHistoryView: View {
    let buckets: [Double]
    let unit: SpeedUnit
    var body: some View { SpeedHistoryChart(buckets: buckets, unit: unit) }
}

struct SpeedHistoryChart: View {
    let buckets: [Double]
    let unit: SpeedUnit
    var foreground: Color = .white

    var body: some View {
        VStack(spacing: 4) {
            Canvas { ctx, size in
                let count  = 10
                let values = buckets.suffix(count)
                let maxVal = max(1.0, values.map { unit.value($0) }.max() ?? 1)
                let gap: CGFloat = 4
                let barW = (size.width - gap * CGFloat(count - 1)) / CGFloat(count)
                let chartH = size.height
                let emptySlots = count - values.count

                for (i, speed) in values.enumerated() {
                    let slot  = emptySlots + i
                    let x     = CGFloat(slot) * (barW + gap)
                    let disp  = unit.value(speed)
                    let barH  = max(2, CGFloat(disp / maxVal) * (chartH - 20))
                    let rect  = CGRect(x: x, y: chartH - barH, width: barW, height: barH)
                    let alpha: Double = i == values.count - 1 ? 1.0 : 0.7
                    ctx.fill(Path(rect), with: .color(foreground.opacity(alpha)))

                    let label = String(format: "%.0f", disp)
                    ctx.draw(
                        Text(label)
                            .font(.system(size: 8, design: .monospaced))
                            .foregroundColor(foreground.opacity(0.5)),
                        at: .init(x: x + barW / 2, y: chartH - barH - 8)
                    )
                }
            }

            HStack(spacing: 0) {
                ForEach(Array((0..<10).reversed()), id: \.self) { i in
                    Text(i == 0 ? "NOW" : "−\(i * 3)m")
                        .font(.system(size: 7, design: .monospaced))
                        .foregroundColor(foreground.opacity(0.22))
                        .frame(maxWidth: .infinity)
                }
            }
        }
    }
}
