import SwiftUI

// MARK: – State machine

private enum Phase {
    case waiting
    case collecting(since: Date)
    case analyzing
    case done(stats: WindStats, summary: String)

    static let targetSeconds: Double = 15 * 60   // 15 min

    var isCollecting: Bool {
        if case .collecting = self { return true }; return false
    }
}

// MARK: – Main view

struct RaceAreaView: View {
    @ObservedObject var bluetooth: BluetoothManager
    @State private var phase: Phase     = .waiting
    @State private var timeString       = ""
    @State private var elapsed: Double  = 0        // seconds since arrival
    @State private var errorMsg: String?= nil
    @State private var showKeyEntry     = false
    @State private var raceSamples: [BluetoothManager.WindSample] = []

    private let clock = Timer.publish(every: 1, on: .main, in: .common).autoconnect()

    var body: some View {
        ZStack {
            Color.black.ignoresSafeArea()

            VStack(spacing: 0) {
                header

                switch phase {
                case .waiting:    waitingBody
                case .collecting: collectingBody
                case .analyzing:  analyzingBody
                case .done(let stats, let summary):
                    summaryBody(stats: stats, summary: summary)
                }
            }
        }
        .onReceive(clock) { _ in
            // Update clock
            let f = DateFormatter(); f.dateFormat = "HH:mm:ss"
            timeString = f.string(from: Date())

            // Tick elapsed + snapshot samples
            if case .collecting(let since) = phase {
                elapsed = Date().timeIntervalSince(since)
                raceSamples = bluetooth.samples.filter { $0.time >= since }

                if elapsed >= Phase.targetSeconds {
                    startAnalysis()
                }
            }
        }
        .onAppear {
            let f = DateFormatter(); f.dateFormat = "HH:mm:ss"
            timeString = f.string(from: Date())
        }
        .sheet(isPresented: $showKeyEntry) { APIKeySheet() }
    }

    // MARK: – Header

    private var header: some View {
        VStack(spacing: 0) {
            HStack {
                Text("RACE AREA")
                    .font(.system(size: 11, weight: .bold, design: .monospaced))
                    .foregroundColor(.white.opacity(0.4))
                    .tracking(3)
                Spacer()
                Button { showKeyEntry = true } label: {
                    Image(systemName: "key")
                        .font(.system(size: 13))
                        .foregroundColor(.white.opacity(0.35))
                }
                .buttonStyle(.plain)
                .padding(.trailing, 10)
                Text(timeString)
                    .font(.system(size: 22, weight: .bold, design: .monospaced))
                    .foregroundColor(.white)
                    .monospacedDigit()
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 10)
            Rectangle().fill(Color.white.opacity(0.12)).frame(height: 1)
        }
    }

    // MARK: – Waiting state

    private var waitingBody: some View {
        VStack(spacing: 0) {
            // Live wind peek
            liveWindRow

            Rectangle().fill(Color.white.opacity(0.12)).frame(height: 1)

            Spacer()

            VStack(spacing: 28) {
                VStack(spacing: 10) {
                    Image(systemName: "flag.checkered")
                        .font(.system(size: 40, weight: .thin))
                        .foregroundColor(.white.opacity(0.5))
                    Text("ARRIVED AT\nRACE AREA?")
                        .font(.system(size: 22, weight: .bold, design: .monospaced))
                        .foregroundColor(.white)
                        .multilineTextAlignment(.center)
                        .tracking(2)
                }

                Text("Tap to start 15-min wind collection.\nAI will brief you when complete.")
                    .font(.system(size: 12, design: .monospaced))
                    .foregroundColor(.white.opacity(0.35))
                    .multilineTextAlignment(.center)
                    .lineSpacing(4)

                Button {
                    guard !AnthropicClient.apiKey.isEmpty else {
                        showKeyEntry = true; return
                    }
                    confirm()
                } label: {
                    Text("CONFIRM ARRIVAL")
                        .font(.system(size: 14, weight: .bold, design: .monospaced))
                        .tracking(2)
                        .foregroundColor(.black)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 18)
                        .background(Color.white)
                }
                .buttonStyle(.plain)
                .padding(.horizontal, 24)

                if AnthropicClient.apiKey.isEmpty {
                    Text("⚠ Set Anthropic API key first (tap ⚙ above)")
                        .font(.system(size: 11, design: .monospaced))
                        .foregroundColor(.white.opacity(0.4))
                }
            }

            Spacer()
        }
    }

    // MARK: – Collecting state

    private var collectingBody: some View {
        VStack(spacing: 0) {
            // Progress bar
            progressBar

            Rectangle().fill(Color.white.opacity(0.12)).frame(height: 1)

            liveWindRow

            Rectangle().fill(Color.white.opacity(0.12)).frame(height: 1)

            // Mini oscillation chart (grows as data comes in)
            VStack(alignment: .leading, spacing: 6) {
                sectionLabel("WIND SHIFT  (° FROM MEAN)")
                OscillationChart(samples: raceSamples)
                    .frame(height: 120)
                    .padding(.horizontal, 16)
                    .padding(.bottom, 10)
            }

            Rectangle().fill(Color.white.opacity(0.12)).frame(height: 1)

            // Speed mini chart
            VStack(alignment: .leading, spacing: 6) {
                sectionLabel("SPEED HISTORY  (3 MIN BARS)")
                SpeedHistoryChart(buckets: bluetooth.speedBuckets, unit: .knots)
                    .frame(height: 90)
                    .padding(.horizontal, 16)
                    .padding(.bottom, 10)
            }

            Spacer()

            // Abort button
            Button { reset() } label: {
                Text("CANCEL")
                    .font(.system(size: 11, weight: .medium, design: .monospaced))
                    .foregroundColor(.white.opacity(0.3))
            }
            .buttonStyle(.plain)
            .padding(.bottom, 20)
        }
    }

    // MARK: – Analyzing state

    private var analyzingBody: some View {
        VStack(spacing: 24) {
            Spacer()
            ProgressView()
                .progressViewStyle(.circular)
                .scaleEffect(1.4)
                .tint(.white)
            Text("ANALYSING WIND DATA…")
                .font(.system(size: 13, weight: .bold, design: .monospaced))
                .foregroundColor(.white.opacity(0.5))
                .tracking(2)
            if let e = errorMsg {
                Text(e)
                    .font(.system(size: 11, design: .monospaced))
                    .foregroundColor(.white.opacity(0.45))
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, 24)
                Button("RETRY") { startAnalysis() }
                    .font(.system(size: 11, weight: .bold, design: .monospaced))
                    .foregroundColor(.white)
                    .padding(.top, 8)
            }
            Spacer()
        }
    }

    // MARK: – Summary state

    private func summaryBody(stats: WindStats, summary: String) -> some View {
        ScrollView {
            VStack(spacing: 0) {
                // ── Key stats ──────────────────────────────────
                HStack(spacing: 0) {
                    statBox(top: "AVG TWD",
                            value: "\(stats.avgTWD)°",
                            bottom: "\(stats.minTWD)°–\(stats.maxTWD)°")
                    vDivider
                    statBox(top: "TREND",
                            value: (stats.trendTWD >= 0 ? "→" : "←"),
                            bottom: String(format: "%+.1f°", stats.trendTWD))
                }
                hDivider

                HStack(spacing: 0) {
                    statBox(top: "AVG TWS",
                            value: String(format: "%.1f", stats.avgTWS),
                            bottom: "KTS")
                    vDivider
                    statBox(top: "MAX TWS",
                            value: String(format: "%.1f", stats.maxTWS),
                            bottom: stats.trendTWS >= 0 ? "▲ BUILDING" : "▼ DROPPING")
                }
                hDivider

                statBox(top: "OSCILLATION",
                        value: "±\(String(format:"%.0f",stats.oscAmplitude))°",
                        bottom: "\(stats.sampleCount) samples · \(String(format:"%.0f",stats.durationMin)) min")
                    .frame(maxWidth: .infinity)

                hDivider

                // ── AI Brief ───────────────────────────────────
                VStack(alignment: .leading, spacing: 10) {
                    Text("AI WIND BRIEF")
                        .font(.system(size: 10, weight: .bold, design: .monospaced))
                        .foregroundColor(.white.opacity(0.3))
                        .tracking(2)
                    Text(summary)
                        .font(.system(size: 14, design: .monospaced))
                        .foregroundColor(.white)
                        .lineSpacing(5)
                        .fixedSize(horizontal: false, vertical: true)
                }
                .padding(18)

                hDivider

                // Reset
                Button {
                    reset()
                } label: {
                    Text("RESET — COLLECT NEW DATA")
                        .font(.system(size: 11, weight: .bold, design: .monospaced))
                        .foregroundColor(.white.opacity(0.4))
                        .tracking(2)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 18)
                }
                .buttonStyle(.plain)
            }
        }
    }

    // MARK: – Shared sub-views

    private var liveWindRow: some View {
        HStack(spacing: 0) {
            VStack(alignment: .leading, spacing: 0) {
                sectionLabel("TWD")
                HStack(alignment: .lastTextBaseline, spacing: 8) {
                    Text("\(bluetooth.windData.windDirection)°")
                        .font(.system(size: 52, weight: .bold, design: .monospaced))
                        .foregroundColor(.white)
                    Text(compassLabel(bluetooth.windData.windDirection))
                        .font(.system(size: 20, design: .monospaced))
                        .foregroundColor(.white.opacity(0.4))
                }
                .padding(.leading, 16)
                .padding(.bottom, 8)
            }

            Rectangle().fill(Color.white.opacity(0.12)).frame(width: 1)

            VStack(alignment: .leading, spacing: 0) {
                sectionLabel("TWS")
                Text(String(format: "%.1f", bluetooth.windData.windSpeedKnots))
                    .font(.system(size: 52, weight: .bold, design: .monospaced))
                    .foregroundColor(.white)
                    .padding(.leading, 16)
                    .padding(.bottom, 8)
            }
        }
    }

    private var progressBar: some View {
        VStack(spacing: 0) {
            HStack {
                Text(timeFormatted(elapsed))
                    .font(.system(size: 32, weight: .bold, design: .monospaced))
                    .foregroundColor(.white)
                    .monospacedDigit()
                Text(" / 15:00")
                    .font(.system(size: 16, design: .monospaced))
                    .foregroundColor(.white.opacity(0.35))
                Spacer()
                Text("\(raceSamples.count) SAMPLES")
                    .font(.system(size: 10, design: .monospaced))
                    .foregroundColor(.white.opacity(0.3))
                    .tracking(1.5)
            }
            .padding(.horizontal, 16)
            .padding(.top, 14)
            .padding(.bottom, 10)

            GeometryReader { geo in
                ZStack(alignment: .leading) {
                    Rectangle().fill(Color.white.opacity(0.08))
                    Rectangle()
                        .fill(Color.white)
                        .frame(width: geo.size.width * CGFloat(min(1, elapsed / Phase.targetSeconds)))
                        .animation(.linear(duration: 1), value: elapsed)
                }
            }
            .frame(height: 3)
        }
    }

    // MARK: – Stat box helpers

    private func statBox(top: String, value: String, bottom: String) -> some View {
        VStack(spacing: 4) {
            Text(top)
                .font(.system(size: 10, weight: .medium, design: .monospaced))
                .foregroundColor(.white.opacity(0.3))
                .tracking(2)
            Text(value)
                .font(.system(size: 44, weight: .bold, design: .monospaced))
                .foregroundColor(.white)
                .minimumScaleFactor(0.5)
                .lineLimit(1)
            Text(bottom)
                .font(.system(size: 11, design: .monospaced))
                .foregroundColor(.white.opacity(0.4))
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 16)
    }

    private var hDivider: some View { Rectangle().fill(Color.white.opacity(0.12)).frame(height: 1) }
    private var vDivider: some View { Rectangle().fill(Color.white.opacity(0.12)).frame(width: 1) }

    private func sectionLabel(_ t: String) -> some View {
        Text(t)
            .font(.system(size: 10, weight: .medium, design: .monospaced))
            .foregroundColor(.white.opacity(0.3))
            .tracking(2)
            .padding(.leading, 16)
            .padding(.top, 10)
            .padding(.bottom, 4)
    }

    // MARK: – Actions

    private func confirm() {
        elapsed = 0
        raceSamples = []
        phase = .collecting(since: Date())
    }

    private func startAnalysis() {
        phase = .analyzing
        errorMsg = nil
        let snap = raceSamples
        Task {
            do {
                let summary = try await AnthropicClient.analyze(samples: snap)
                let stats   = AnthropicClient.stats(from: snap)
                await MainActor.run { phase = .done(stats: stats, summary: summary) }
            } catch {
                await MainActor.run {
                    errorMsg = error.localizedDescription
                }
            }
        }
    }

    private func reset() {
        phase = .waiting
        raceSamples = []
        elapsed = 0
        errorMsg = nil
    }

    // MARK: – Formatting

    private func timeFormatted(_ s: Double) -> String {
        let m = Int(s) / 60, sec = Int(s) % 60
        return String(format: "%02d:%02d", m, sec)
    }

    private func compassLabel(_ deg: Int) -> String {
        let pts = ["N","NNE","NE","ENE","E","ESE","SE","SSE",
                   "S","SSW","SW","WSW","W","WNW","NW","NNW"]
        return pts[((deg + 11) / 22) % 16]
    }
}

// MARK: – API Key entry sheet

struct APIKeySheet: View {
    @Environment(\.dismiss) var dismiss
    @State private var key = AnthropicClient.apiKey

    var body: some View {
        ZStack {
            Color.black.ignoresSafeArea()
            VStack(spacing: 0) {
                HStack {
                    Text("ANTHROPIC API KEY")
                        .font(.system(size: 12, weight: .bold, design: .monospaced))
                        .foregroundColor(.white)
                        .tracking(2)
                    Spacer()
                    Button("SAVE") {
                        AnthropicClient.apiKey = key.trimmingCharacters(in: .whitespaces)
                        dismiss()
                    }
                    .font(.system(size: 12, weight: .bold, design: .monospaced))
                    .foregroundColor(.white)
                }
                .padding(18)

                Rectangle().fill(Color.white.opacity(0.12)).frame(height: 1)

                VStack(alignment: .leading, spacing: 12) {
                    Text("Enter your key from console.anthropic.com")
                        .font(.system(size: 11, design: .monospaced))
                        .foregroundColor(.white.opacity(0.35))

                    TextField("sk-ant-...", text: $key)
                        .font(.system(size: 13, design: .monospaced))
                        .foregroundColor(.white)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                        .padding(12)
                        .overlay(Rectangle().stroke(Color.white.opacity(0.25), lineWidth: 1))

                    Text("Key is stored on-device only and used solely to call the Claude API for wind analysis.")
                        .font(.system(size: 10, design: .monospaced))
                        .foregroundColor(.white.opacity(0.25))
                        .lineSpacing(4)
                }
                .padding(18)
            }
        }
        .presentationDetents([.medium])
        .preferredColorScheme(.dark)
    }
}
