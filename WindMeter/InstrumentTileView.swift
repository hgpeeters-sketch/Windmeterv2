import SwiftUI

// MARK: – Shared speed unit

enum SpeedUnit: String, CaseIterable {
    case knots = "KTS", ms = "M/S", kmh = "KM/H"
    func value(_ mps: Double) -> Double {
        switch self { case .knots: return mps * 1.94384; case .ms: return mps; case .kmh: return mps * 3.6 }
    }
}

// MARK: – Tile

struct InstrumentTileView: View {
    let config: TileConfig
    let data: WindData
    let maxSpeed: Double
    let avgSpeed: Double
    let unit: SpeedUnit
    let tileStore: TileStore
    let large: Bool

    // MARK: Computed display values

    private var label: String {
        switch config.type {
        case .maxSpeed: return "MAX \(unit.rawValue)"
        case .avgSpeed: return "AVG \(unit.rawValue)"
        default:        return config.type.rawValue
        }
    }

    private var value: String {
        switch config.type {
        case .windSpeed:     return String(format: "%.1f", unit.value(data.windSpeed))
        case .windDirection: return "\(data.windDirection)°"
        case .heading:       return "\(data.heading)°"
        case .temperature:   return String(format: "%.1f°", data.temperature)
        case .battery:       return "\(data.batteryLevel)%"
        case .roll:          return String(format: "%+.0f°", data.roll)
        case .pitch:         return String(format: "%+.0f°", data.pitch)
        case .maxSpeed:      return String(format: "%.1f", unit.value(maxSpeed))
        case .avgSpeed:      return String(format: "%.1f", unit.value(avgSpeed))
        case .shift:         return shiftValue
        case .liftHeader:    return liftValue
        }
    }

    private var suffix: String? {
        switch config.type {
        case .windDirection:
            let pts = ["N","NNE","NE","ENE","E","ESE","SE","SSE",
                       "S","SSW","SW","WSW","W","WNW","NW","NNW"]
            return pts[((data.windDirection + 11) / 22) % 16]
        case .shift:
            return shiftSuffix
        default:
            return nil
        }
    }

    // MARK: Racing calculations

    // Wind shift = current TWD minus the locked reference TWD.
    // Positive → wind has shifted right (lift on starboard tack).
    // Negative → wind has shifted left  (lift on port tack).
    private var shiftDeg: Int {
        guard let ref = tileStore.referenceTWD else { return 0 }
        var d = data.windDirection - ref
        if d >  180 { d -= 360 }
        if d < -180 { d += 360 }
        return d
    }
    private var shiftValue: String {
        guard tileStore.referenceTWD != nil else { return "SET REF" }
        let s = shiftDeg
        return s == 0 ? "0°" : String(format: "%+d°", s)
    }
    private var shiftSuffix: String? {
        guard tileStore.referenceTWD != nil else { return nil }
        if shiftDeg > 2  { return "→ STBD LIFT" }
        if shiftDeg < -2 { return "← PORT LIFT" }
        return "STEADY"
    }
    private var shiftColor: Color {
        guard tileStore.referenceTWD != nil else { return .white.opacity(0.35) }
        if shiftDeg > 2  { return .white }
        if shiftDeg < -2 { return .white }
        return .white
    }

    // Lift / Header based on mark bearing.
    // Optimal TWD for stbd tack = markBearing − tackAngle
    // A shift above that reference = lift on stbd.
    // Returns e.g. "STBD +8°" or "PORT −5°" or "EVEN"
    private var liftValue: String {
        let mark = tileStore.markBearing
        guard mark != 0 else { return "SET MARK" }
        let stbdRef = normalise(mark - tileStore.tackAngle)
        var diff = data.windDirection - stbdRef
        if diff >  180 { diff -= 360 }
        if diff < -180 { diff += 360 }
        if      diff >  2 { return "STBD \(diff)°↑" }
        else if diff < -2 { return "PORT \(-diff)°↑" }
        else              { return "EVEN" }
    }
    private func normalise(_ d: Int) -> Int { ((d % 360) + 360) % 360 }

    // MARK: View

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            // Label
            Text(label)
                .font(.system(size: 11, weight: .medium, design: .monospaced))
                .foregroundColor(.white.opacity(0.3))
                .tracking(2.5)
                .padding(.top, 12)
                .padding(.leading, 20)

            Spacer(minLength: 0)

            // Value + suffix
            HStack(alignment: .lastTextBaseline, spacing: 10) {
                Text(value)
                    .font(.system(size: large ? 84 : 62,
                                  weight: .bold,
                                  design: .monospaced))
                    .foregroundColor(.white)
                    .minimumScaleFactor(0.45)
                    .lineLimit(1)
                    .contentTransition(.numericText())
                    .animation(.spring(response: 0.25), value: value)

                if let suf = suffix {
                    Text(suf)
                        .font(.system(size: large ? 26 : 20,
                                      weight: .regular,
                                      design: .monospaced))
                        .foregroundColor(.white.opacity(0.45))
                        .minimumScaleFactor(0.6)
                        .lineLimit(1)
                }
            }
            .padding(.leading, 20)
            .padding(.trailing, 12)

            Spacer(minLength: 0)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .frame(height: large ? 134 : 100)
        .background(Color.black)
    }
}
