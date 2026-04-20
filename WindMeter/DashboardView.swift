import SwiftUI

struct DashboardView: View {
    @ObservedObject var bluetooth: BluetoothManager
    @State private var unit: SpeedUnit = .knots

    enum SpeedUnit: String, CaseIterable {
        case knots = "KTS", ms = "M/S", kmh = "KM/H"
        func value(from d: WindData) -> Double {
            switch self {
            case .knots: return d.windSpeedKnots
            case .ms:    return d.windSpeed
            case .kmh:   return d.windSpeedKmh
            }
        }
    }

    private var data: WindData { bluetooth.windData }

    var body: some View {
        ZStack {
            Color.black.ignoresSafeArea()

            VStack(spacing: 0) {

                // ── Status strip ─────────────────────────────────
                HStack {
                    Text("● CALYPSO UP10")
                        .font(.system(size: 11, weight: .medium, design: .monospaced))
                        .foregroundColor(.white.opacity(0.5))
                    Spacer()
                    Text("BAT \(data.batteryLevel)%")
                        .font(.system(size: 11, weight: .medium, design: .monospaced))
                        .foregroundColor(.white.opacity(0.5))
                }
                .padding(.horizontal, 16)
                .padding(.vertical, 10)

                Divider().background(Color.white.opacity(0.2))

                // ── Wind Speed (large box) ────────────────────────
                Button(action: cycleUnit) {
                    InstrumentBox {
                        VStack(spacing: 6) {
                            Label("TWS", unit: unit.rawValue)
                            Text(String(format: "%.1f", unit.value(from: data)))
                                .font(.system(size: 88, weight: .bold, design: .monospaced))
                                .foregroundColor(.white)
                                .contentTransition(.numericText())
                                .animation(.spring(response: 0.3), value: data.windSpeed)
                        }
                    }
                    .frame(height: 148)
                }
                .buttonStyle(.plain)

                Divider().background(Color.white.opacity(0.2))

                // ── Wind Direction + Compass ──────────────────────
                HStack(spacing: 0) {
                    InstrumentBox {
                        VStack(spacing: 6) {
                            Label("TWD", unit: "")
                            Text("\(data.windDirection)°")
                                .font(.system(size: 52, weight: .bold, design: .monospaced))
                                .foregroundColor(.white)
                                .animation(.spring(response: 0.4), value: data.windDirection)
                            Text(compassLabel(data.windDirection))
                                .font(.system(size: 20, weight: .semibold, design: .monospaced))
                                .foregroundColor(.white.opacity(0.6))
                        }
                    }

                    Divider().background(Color.white.opacity(0.2))
                        .frame(width: 1)

                    InstrumentBox {
                        WindRoseView(direction: data.windDirection, heading: data.heading)
                    }
                }
                .frame(height: 160)

                Divider().background(Color.white.opacity(0.2))

                // ── 2×2 data grid ─────────────────────────────────
                VStack(spacing: 0) {
                    HStack(spacing: 0) {
                        InstrumentBox {
                            SmallInstrument(label: "HDG", value: "\(data.heading)°")
                        }
                        Divider().background(Color.white.opacity(0.2)).frame(width: 1)
                        InstrumentBox {
                            SmallInstrument(label: "TEMP", value: String(format: "%.0f°C", data.temperature))
                        }
                    }
                    Divider().background(Color.white.opacity(0.2))
                    HStack(spacing: 0) {
                        InstrumentBox {
                            SmallInstrument(
                                label: "MAX \(unit.rawValue)",
                                value: String(format: "%.1f", unit.value(from: WindData(windSpeed: bluetooth.maxWindSpeed)))
                            )
                        }
                        Divider().background(Color.white.opacity(0.2)).frame(width: 1)
                        InstrumentBox {
                            SmallInstrument(
                                label: "AVG \(unit.rawValue)",
                                value: String(format: "%.1f", unit.value(from: WindData(windSpeed: bluetooth.avgWindSpeed)))
                            )
                        }
                    }
                }
                .frame(maxHeight: .infinity)

                Divider().background(Color.white.opacity(0.2))

                // ── Roll / Pitch strip ────────────────────────────
                HStack(spacing: 0) {
                    InstrumentBox {
                        SmallInstrument(label: "ROLL",
                                        value: String(format: "%+.0f°", data.roll))
                    }
                    Divider().background(Color.white.opacity(0.2)).frame(width: 1)
                    InstrumentBox {
                        SmallInstrument(label: "PITCH",
                                        value: String(format: "%+.0f°", data.pitch))
                    }
                    Divider().background(Color.white.opacity(0.2)).frame(width: 1)
                    InstrumentBox {
                        SmallInstrument(label: "BAT",
                                        value: "\(data.batteryLevel)%")
                    }
                }
                .frame(height: 82)

            }
        }
        .preferredColorScheme(.dark)
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

// MARK: – Shared sub-views

struct InstrumentBox<Content: View>: View {
    let content: () -> Content
    init(@ViewBuilder content: @escaping () -> Content) { self.content = content }
    var body: some View {
        ZStack { content() }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}

private struct Label: View {
    let label: String
    let unit: String
    init(_ label: String, unit: String) { self.label = label; self.unit = unit }
    var body: some View {
        HStack(spacing: 4) {
            Text(label)
                .font(.system(size: 11, weight: .semibold, design: .monospaced))
                .foregroundColor(.white.opacity(0.45))
                .tracking(2)
            if !unit.isEmpty {
                Text(unit)
                    .font(.system(size: 11, weight: .regular, design: .monospaced))
                    .foregroundColor(.white.opacity(0.3))
            }
        }
    }
}

struct SmallInstrument: View {
    let label: String
    let value: String
    var body: some View {
        VStack(spacing: 5) {
            Text(label)
                .font(.system(size: 10, weight: .semibold, design: .monospaced))
                .foregroundColor(.white.opacity(0.4))
                .tracking(1.5)
            Text(value)
                .font(.system(size: 30, weight: .bold, design: .monospaced))
                .foregroundColor(.white)
                .minimumScaleFactor(0.6)
                .lineLimit(1)
        }
    }
}
