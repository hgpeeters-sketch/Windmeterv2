import SwiftUI

struct DashboardView: View {
    @ObservedObject var bluetooth: BluetoothManager
    @State private var unit: SpeedUnit = .knots

    enum SpeedUnit: String, CaseIterable {
        case knots = "KTS", ms = "m/s", kmh = "km/h"
        func value(from d: WindData) -> Double {
            switch self {
            case .knots: return d.windSpeedKnots
            case .ms:    return d.windSpeed
            case .kmh:   return d.windSpeedKmh
            }
        }
        func formatted(_ v: Double) -> String { String(format: "%.1f", v) }
    }

    private var data: WindData { bluetooth.windData }
    private let cyan = Color.cyan
    private let bg   = Color(red: 0.03, green: 0.04, blue: 0.08)

    var body: some View {
        ZStack {
            bg.ignoresSafeArea()

            VStack(spacing: 0) {

                // ── Top bar ─────────────────────────────────────────────
                HStack {
                    // Connection dot + label
                    HStack(spacing: 6) {
                        Circle().fill(cyan).frame(width: 7, height: 7)
                            .shadow(color: cyan.opacity(0.8), radius: 4)
                        Text("CALYPSO UP10")
                            .font(.system(size: 11, weight: .semibold, design: .monospaced))
                            .foregroundColor(cyan.opacity(0.9))
                            .tracking(1.5)
                    }
                    Spacer()
                    BatteryIndicator(level: data.batteryLevel)
                }
                .padding(.horizontal, 22)
                .padding(.top, 16)

                Spacer(minLength: 12)

                // ── Compass + speed overlay ───────────────────────────
                ZStack {
                    WindCompassView(direction: data.windDirection, diameter: 290)

                    VStack(spacing: 2) {
                        // Main speed number
                        Text(unit.formatted(unit.value(from: data)))
                            .font(.system(size: 68, weight: .bold, design: .monospaced))
                            .foregroundColor(.white)
                            .contentTransition(.numericText())
                            .animation(.spring(response: 0.3), value: data.windSpeed)

                        // Tappable unit badge
                        Button { cycleUnit() } label: {
                            Text(unit.rawValue)
                                .font(.system(size: 16, weight: .semibold, design: .monospaced))
                                .foregroundColor(cyan)
                                .padding(.horizontal, 12)
                                .padding(.vertical, 4)
                                .background(cyan.opacity(0.12))
                                .cornerRadius(8)
                        }
                        .buttonStyle(.plain)
                    }
                }

                Spacer(minLength: 8)

                // ── Direction readout ────────────────────────────────
                VStack(spacing: 4) {
                    Text("\(data.windDirection)°  \(compassLabel(data.windDirection))")
                        .font(.system(size: 24, weight: .semibold, design: .monospaced))
                        .foregroundColor(cyan)
                        .animation(.spring(response: 0.4), value: data.windDirection)

                    Text("WIND FROM")
                        .font(.system(size: 10, weight: .medium))
                        .foregroundColor(.white.opacity(0.3))
                        .tracking(2)
                }
                .padding(.bottom, 18)

                // ── Data tiles ───────────────────────────────────────
                LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 10), count: 3),
                          spacing: 10) {
                    DataTileView(label: "HEADING",
                                 value: "\(data.heading)°",
                                 icon: "safari")
                    DataTileView(label: "TEMP",
                                 value: String(format: "%.0f°C", data.temperature),
                                 icon: "thermometer.medium")
                    DataTileView(label: "BATTERY",
                                 value: "\(data.batteryLevel)%",
                                 icon: "battery.75",
                                 accent: batteryColor(data.batteryLevel))
                    DataTileView(label: "MAX \(unit.rawValue)",
                                 value: unit.formatted(unit.value(from: WindData(windSpeed: bluetooth.maxWindSpeed))),
                                 icon: "arrow.up.right",
                                 accent: .orange.opacity(0.8))
                    DataTileView(label: "AVG \(unit.rawValue)",
                                 value: unit.formatted(unit.value(from: WindData(windSpeed: bluetooth.avgWindSpeed))),
                                 icon: "waveform.path",
                                 accent: .green.opacity(0.8))
                    DataTileView(label: "ROLL / PITCH",
                                 value: String(format: "%.0f/%.0f°", data.roll, data.pitch),
                                 icon: "rotate.3d")
                }
                .padding(.horizontal, 16)
                .padding(.bottom, 24)
            }
        }
    }

    private func cycleUnit() {
        let all = SpeedUnit.allCases
        let next = (all.firstIndex(of: unit)! + 1) % all.count
        withAnimation { unit = all[next] }
    }

    private func batteryColor(_ pct: Int) -> Color {
        pct > 30 ? Color.cyan.opacity(0.7) : Color.orange.opacity(0.8)
    }

    private func compassLabel(_ deg: Int) -> String {
        let pts = ["N","NNE","NE","ENE","E","ESE","SE","SSE",
                   "S","SSW","SW","WSW","W","WNW","NW","NNW"]
        return pts[((deg + 11) / 22) % 16]
    }
}

// MARK: – Battery indicator widget
private struct BatteryIndicator: View {
    let level: Int
    var color: Color { level > 30 ? .cyan : .orange }

    var body: some View {
        HStack(spacing: 4) {
            ZStack(alignment: .leading) {
                RoundedRectangle(cornerRadius: 2.5)
                    .stroke(Color.white.opacity(0.25), lineWidth: 1)
                    .frame(width: 26, height: 13)
                RoundedRectangle(cornerRadius: 2)
                    .fill(color)
                    .frame(width: max(2, CGFloat(level) / 100 * 24), height: 11)
                    .padding(.leading, 1)
            }
            RoundedRectangle(cornerRadius: 1)
                .fill(Color.white.opacity(0.25))
                .frame(width: 3, height: 6)
            Text("\(level)%")
                .font(.system(size: 11, weight: .medium, design: .monospaced))
                .foregroundColor(.white.opacity(0.45))
        }
    }
}
