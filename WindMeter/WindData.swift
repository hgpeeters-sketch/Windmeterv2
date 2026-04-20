import Foundation

struct WindData {
    var windSpeed: Double = 0.0         // m/s
    var windDirection: Int = 0          // degrees 0–359 (where wind comes FROM)
    var batteryLevel: Int = 0           // 0–100 %
    var temperature: Double = 0.0       // °C
    var roll: Double = 0.0              // degrees
    var pitch: Double = 0.0             // degrees
    var heading: Int = 0                // magnetic heading degrees

    var windSpeedKnots: Double { windSpeed * 1.94384 }
    var windSpeedKmh: Double { windSpeed * 3.6 }

    // 10-byte CalypsoReading packet (UUID 0x2A39, service 0x180D)
    // [0–1] uint16 LE wind speed   /100 → m/s
    // [2–3] uint16 LE wind dir     degrees
    // [4]   uint8  battery         ×10 → %
    // [5]   uint8  temperature     −100 → °C
    // [6]   uint8  roll            −90 → °
    // [7]   uint8  pitch           −90 → °
    // [8–9] uint16 LE heading      (360 − value) % 360 → °
    static func from(data: Data) -> WindData? {
        guard data.count >= 5 else { return nil }
        var r = WindData()
        let speedRaw = UInt16(data[0]) | (UInt16(data[1]) << 8)
        r.windSpeed = Double(speedRaw) / 100.0
        let dirRaw = UInt16(data[2]) | (UInt16(data[3]) << 8)
        r.windDirection = Int(dirRaw) % 360
        r.batteryLevel = min(100, Int(data[4]) * 10)
        if data.count >= 6 { r.temperature = Double(data[5]) - 100.0 }
        if data.count >= 7 { r.roll  = Double(data[6]) - 90.0 }
        if data.count >= 8 { r.pitch = Double(data[7]) - 90.0 }
        if data.count >= 10 {
            let h = UInt16(data[8]) | (UInt16(data[9]) << 8)
            r.heading = (360 - Int(h)) % 360
        }
        return r
    }
}
