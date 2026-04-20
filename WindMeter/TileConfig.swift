import Foundation

enum InstrumentType: String, Codable, CaseIterable, Identifiable {
    // Wind
    case windSpeed     = "TWS"
    case windDirection = "TWD"
    case maxSpeed      = "MAX"
    case avgSpeed      = "AVG"
    // Navigation
    case heading       = "HDG"
    // Racing
    case shift         = "SHIFT"   // wind oscillation vs reference TWD
    case liftHeader    = "LIFT"    // lift / header vs mark bearing
    // Sensor
    case temperature   = "TEMP"
    case battery       = "BAT"
    case roll          = "ROLL"
    case pitch         = "PITCH"

    var id: String { rawValue }

    var fullName: String {
        switch self {
        case .windSpeed:     return "True Wind Speed"
        case .windDirection: return "Wind Direction"
        case .heading:       return "Heading"
        case .temperature:   return "Temperature"
        case .battery:       return "Battery"
        case .roll:          return "Roll"
        case .pitch:         return "Pitch"
        case .maxSpeed:      return "Max Wind Speed"
        case .avgSpeed:      return "Avg Wind Speed"
        case .shift:         return "Wind Shift (vs reference)"
        case .liftHeader:    return "Lift / Header (mark bearing)"
        }
    }
}

struct TileConfig: Identifiable, Codable {
    var id = UUID()
    var type: InstrumentType
}

final class TileStore: ObservableObject {
    @Published var tiles: [TileConfig] {
        didSet { persist() }
    }
    /// Reference TWD locked in by sailor (for SHIFT tile)
    @Published var referenceTWD: Int? {
        didSet { UserDefaults.standard.set(referenceTWD, forKey: "refTWD") }
    }
    /// Bearing to windward mark (for LIFT tile), degrees
    @Published var markBearing: Int {
        didSet { UserDefaults.standard.set(markBearing, forKey: "markBearing") }
    }
    /// Assumed tack angle each side of wind (default 45°)
    @Published var tackAngle: Int {
        didSet { UserDefaults.standard.set(tackAngle, forKey: "tackAngle") }
    }

    static let defaults: [TileConfig] = [
        .init(type: .windSpeed),
        .init(type: .windDirection),
        .init(type: .shift),
        .init(type: .liftHeader),
        .init(type: .heading),
        .init(type: .maxSpeed),
        .init(type: .avgSpeed),
        .init(type: .temperature),
        .init(type: .battery),
    ]

    init() {
        if let data = UserDefaults.standard.data(forKey: "tiles"),
           let decoded = try? JSONDecoder().decode([TileConfig].self, from: data) {
            tiles = decoded
        } else {
            tiles = Self.defaults
        }
        referenceTWD = UserDefaults.standard.object(forKey: "refTWD") as? Int
        markBearing  = UserDefaults.standard.integer(forKey: "markBearing")   // 0 if unset
        tackAngle    = UserDefaults.standard.object(forKey: "tackAngle") as? Int ?? 45
    }

    private func persist() {
        if let data = try? JSONEncoder().encode(tiles) {
            UserDefaults.standard.set(data, forKey: "tiles")
        }
    }

    func move(from: IndexSet, to: Int) { tiles.move(fromOffsets: from, toOffset: to) }
    func delete(at: IndexSet)          { tiles.remove(atOffsets: at) }
    func add(_ type: InstrumentType) {
        guard !tiles.contains(where: { $0.type == type }) else { return }
        tiles.append(.init(type: type))
    }
    var addable: [InstrumentType] {
        InstrumentType.allCases.filter { t in !tiles.contains(where: { $0.type == t }) }
    }
}
