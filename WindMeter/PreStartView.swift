import SwiftUI

struct PreStartView: View {
    @ObservedObject var bluetooth: BluetoothManager
    @State private var unit: SpeedUnit = .knots
    @State private var timeString = ""

    private let clock = Timer.publish(every: 1, on: .main, in: .common).autoconnect()

    var body: some View {
        ZStack {
            Color.black.ignoresSafeArea()

            VStack(spacing: 0) {

                // ── Header ──────────────────────────────────────────
                HStack {
                    Text("PRE-START")
                        .font(.system(size: 11, weight: .bold, design: .monospaced))
                        .foregroundColor(.white.opacity(0.4))
                        .tracking(3)
                    Spacer()
                    Text(timeString)
                        .font(.system(size: 22, weight: .bold, design: .monospaced))
                        .foregroundColor(.white)
                        .monospacedDigit()
                }
                .padding(.horizontal, 16)
                .padding(.vertical, 10)

                divider

                // ── TWD ─────────────────────────────────────────────
                VStack(alignment: .leading, spacing: 0) {
                    rowLabel("TWD")
                    HStack(alignment: .lastTextBaseline, spacing: 12) {
                        Text("\(bluetooth.windData.windDirection)°")
                            .font(.system(size: 76, weight: .bold, design: .monospaced))
                            .foregroundColor(.white)
                            .contentTransition(.numericText())
                            .animation(.spring(response: 0.3), value: bluetooth.windData.windDirection)
                        Text(compassLabel(bluetooth.windData.windDirection))
                            .font(.system(size: 30, weight: .regular, design: .monospaced))
                            .foregroundColor(.white.opacity(0.4))
                    }
                    .padding(.leading, 16)
                    .padding(.bottom, 10)
                }

                divider

                // ── Oscillation chart ────────────────────────────────
                VStack(alignment: .leading, spacing: 6) {
                    rowLabel("WIND SHIFT  (° FROM MEAN)")
                    OscillationChart(samples: bluetooth.samples)
                        .frame(height: 130)
                        .padding(.horizontal, 16)
                        .padding(.bottom, 10)
                }

                divider

                // ── TWS ─────────────────────────────────────────────
                VStack(alignment: .leading, spacing: 0) {
                    HStack {
                        rowLabel("TWS")
                        Spacer()
                        Button { cycleUnit() } label: {
                            Text(unit.rawValue)
                                .font(.system(size: 11, weight: .bold, design: .monospaced))
                                .foregroundColor(.white.opacity(0.7))
                                .padding(.horizontal, 8).padding(.vertical, 4)
                                .overlay(RoundedRectangle(cornerRadius: 4)
                                    .stroke(Color.white.opacity(0.28), lineWidth: 1))
                        }
                        .buttonStyle(.plain)
                        .padding(.trailing, 16)
                    }
                    HStack(alignment: .lastTextBaseline, spacing: 10) {
                        Text(String(format: "%.1f", unit.value(bluetooth.windData.windSpeed)))
                            .font(.system(size: 76, weight: .bold, design: .monospaced))
                            .foregroundColor(.white)
                            .contentTransition(.numericText())
                            .animation(.spring(response: 0.3), value: bluetooth.windData.windSpeed)
                        Text(unit.rawValue)
                            .font(.system(size: 26, weight: .regular, design: .monospaced))
                            .foregroundColor(.white.opacity(0.35))
                    }
                    .padding(.leading, 16)
                    .padding(.bottom, 10)
                }

                divider

                // ── 30-min speed history ────────────────────────────
                VStack(alignment: .leading, spacing: 6) {
                    rowLabel("WIND SPEED  (30 MIN, 3 MIN BARS)")
                    SpeedHistoryChart(buckets: bluetooth.speedBuckets, unit: unit)
                        .frame(height: 110)
                        .padding(.horizontal, 16)
                        .padding(.bottom, 10)
                }

                Spacer(minLength: 0)
            }
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

    // MARK: – Helpers

    private var divider: some View {
        Rectangle().fill(Color.white.opacity(0.12)).frame(height: 1)
    }

    private func rowLabel(_ text: String) -> some View {
        Text(text)
            .font(.system(size: 10, weight: .medium, design: .monospaced))
            .foregroundColor(.white.opacity(0.3))
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
// Bars centred on a zero line. Positive (right shift) = above; negative (left) = below.

struct OscillationChart: View {
    let samples: [BluetoothManager.WindSample]

    /// Circular mean of recent TWD values, then per-sample deviation.
    private var deviations: [Double] {
        let cutoff = Date().addingTimeInterval(-30 * 60)
        let dirs = samples.filter { $0.time >= cutoff }.map { Double($0.direction) }
        guard dirs.count > 1 else { return [] }

        // Circular mean
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

            // ±10° guide lines
            for ratio in [0.5, 1.0] {
                let y = midY - CGFloat(ratio) * midY * 0.85
                var p = Path(); p.move(to: .init(x: 0, y: y)); p.addLine(to: .init(x: size.width, y: y))
                ctx.stroke(p, with: .color(.white.opacity(0.08)), lineWidth: 1)
                var p2 = Path(); p2.move(to: .init(x: 0, y: size.height - y)); p2.addLine(to: .init(x: size.width, y: size.height - y))
                ctx.stroke(p2, with: .color(.white.opacity(0.08)), lineWidth: 1)
            }

            // Zero line
            var zl = Path()
            zl.move(to: .init(x: 0, y: midY))
            zl.addLine(to: .init(x: size.width, y: midY))
            ctx.stroke(zl, with: .color(.white.opacity(0.35)), lineWidth: 1)

            // Bars
            if devs.isEmpty {
                // Placeholder message
                return
            }
            let totalW = size.width
            let gap: CGFloat = 1
            let barW = (totalW - gap * CGFloat(n - 1)) / CGFloat(n)

            for (i, dev) in devs.enumerated() {
                let barH = max(2, abs(CGFloat(dev)) / CGFloat(maxD) * (midY - 4))
                let x    = CGFloat(i) * (barW + gap)
                let y    = dev >= 0 ? midY - barH : midY
                let rect = CGRect(x: x, y: y, width: max(1, barW), height: barH)
                // Right shift (positive) = brighter; left shift = slightly dimmer
                let opacity: Double = dev >= 0 ? 0.95 : 0.65
                ctx.fill(Path(rect), with: .color(.white.opacity(opacity)))
            }
        }
        .overlay(alignment: .topLeading) {
            Text("+")
                .font(.system(size: 9, design: .monospaced))
                .foregroundColor(.white.opacity(0.25))
                .padding(.leading, 2)
        }
        .overlay(alignment: .bottomLeading) {
            Text("−")
                .font(.system(size: 9, design: .monospaced))
                .foregroundColor(.white.opacity(0.25))
                .padding(.leading, 2)
        }
    }
}

// MARK: – Speed history chart
// Up to 10 bars, each = 3-minute average. Newest bar on the right.

struct SpeedHistoryView: View {
    let buckets: [Double]
    let unit: SpeedUnit

    var body: some View { SpeedHistoryChart(buckets: buckets, unit: unit) }
}

struct SpeedHistoryChart: View {
    let buckets: [Double]
    let unit: SpeedUnit

    var body: some View {
        VStack(spacing: 4) {
            Canvas { ctx, size in
                let count  = 10
                let values = buckets.suffix(count)
                let maxVal = max(1.0, values.map { unit.value($0) }.max() ?? 1)
                let gap: CGFloat = 4
                let barW = (size.width - gap * CGFloat(count - 1)) / CGFloat(count)
                let chartH = size.height

                // Draw from oldest (left) to newest (right)
                // Pad with empty slots on the left if fewer than 10 bars
                let emptySlots = count - values.count
                for (i, speed) in values.enumerated() {
                    let slot  = emptySlots + i
                    let x     = CGFloat(slot) * (barW + gap)
                    let disp  = unit.value(speed)
                    let barH  = max(2, CGFloat(disp / maxVal) * (chartH - 20))
                    let rect  = CGRect(x: x, y: chartH - barH, width: barW, height: barH)
                    // Newest bar slightly brighter
                    let alpha: Double = i == values.count - 1 ? 1.0 : 0.7
                    ctx.fill(Path(rect), with: .color(.white.opacity(alpha)))

                    // Value label above bar
                    let label = String(format: "%.0f", disp)
                    ctx.draw(
                        Text(label)
                            .font(.system(size: 8, design: .monospaced))
                            .foregroundColor(.white.opacity(0.5)),
                        at: .init(x: x + barW / 2, y: chartH - barH - 8)
                    )
                }
            }

            // Time axis labels  (−30m … now)
            HStack(spacing: 0) {
                ForEach(Array((0..<10).reversed()), id: \.self) { i in
                    Text(i == 0 ? "NOW" : "−\(i * 3)m")
                        .font(.system(size: 7, design: .monospaced))
                        .foregroundColor(.white.opacity(0.22))
                        .frame(maxWidth: .infinity)
                }
            }
        }
    }
}
