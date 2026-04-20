import Foundation

// MARK: – Response model

private struct AnthropicResponse: Decodable {
    struct Content: Decodable { let text: String; let type: String }
    struct Error:   Decodable { let message: String }
    let content: [Content]?
    let error:   Error?
}

// MARK: – Wind stats computed from samples

struct WindStats {
    let sampleCount: Int
    let durationMin: Double

    let avgTWD: Int          // circular mean
    let minTWD: Int
    let maxTWD: Int
    let trendTWD: Double     // last-third avg − first-third avg (positive = right shift)
    let oscAmplitude: Double // mean absolute deviation from circular mean (°)

    let avgTWS: Double       // knots
    let maxTWS: Double
    let minTWS: Double
    let trendTWS: Double     // last-third avg − first-third avg (positive = building)
}

// MARK: – Client

enum AnthropicClient {

    static var apiKey: String {
        get { UserDefaults.standard.string(forKey: "anthropicKey") ?? "" }
        set { UserDefaults.standard.set(newValue, forKey: "anthropicKey") }
    }

    // MARK: Stats

    static func stats(from samples: [BluetoothManager.WindSample]) -> WindStats {
        guard !samples.isEmpty else {
            return WindStats(sampleCount: 0, durationMin: 0,
                             avgTWD: 0, minTWD: 0, maxTWD: 0, trendTWD: 0, oscAmplitude: 0,
                             avgTWS: 0, maxTWS: 0, minTWS: 0, trendTWS: 0)
        }
        let n  = samples.count
        let t0 = samples.first!.time, t1 = samples.last!.time
        let dur = t1.timeIntervalSince(t0) / 60

        let dirs  = samples.map { Double($0.direction) }
        let spdsK = samples.map { $0.speed * 1.94384 }

        let avgTWD = circularMeanDeg(dirs)
        let osc    = dirs.map { d -> Double in
            var diff = d - avgTWD; if diff > 180 { diff -= 360 }; if diff < -180 { diff += 360 }; return abs(diff)
        }.reduce(0,+) / Double(n)

        let third = max(1, n / 3)
        let firstDirs = Array(dirs.prefix(third))
        let lastDirs  = Array(dirs.suffix(third))
        var trendDir  = circularMeanDeg(lastDirs) - circularMeanDeg(firstDirs)
        if trendDir >  180 { trendDir -= 360 }
        if trendDir < -180 { trendDir += 360 }

        let firstSpd = Array(spdsK.prefix(third)).reduce(0,+) / Double(third)
        let lastSpd  = Array(spdsK.suffix(third)).reduce(0,+) / Double(third)

        return WindStats(
            sampleCount: n,
            durationMin: dur,
            avgTWD: Int(avgTWD.rounded()),
            minTWD: Int(dirs.min()!.rounded()),
            maxTWD: Int(dirs.max()!.rounded()),
            trendTWD: trendDir,
            oscAmplitude: osc,
            avgTWS: spdsK.reduce(0,+) / Double(n),
            maxTWS: spdsK.max()!,
            minTWS: spdsK.min()!,
            trendTWS: lastSpd - firstSpd
        )
    }

    // MARK: API call

    static func analyze(samples: [BluetoothManager.WindSample]) async throws -> String {
        guard !apiKey.isEmpty else { throw APIError.noKey }
        guard !samples.isEmpty else { throw APIError.noData }

        let s    = stats(from: samples)
        let dirs = samples.enumerated()
                          .filter { $0.offset % 3 == 0 }   // every 3rd sample ≈ 30s
                          .map    { "\($0.element.direction)°" }
                          .joined(separator: " ")

        let prompt = """
You are a tactical AI assistant for a racing sailor. \
Analyze 15 min of wind data collected at the race area.

DATA:
- Samples: \(s.sampleCount) over \(String(format:"%.0f",s.durationMin)) min
- TWD avg: \(s.avgTWD)°, range \(s.minTWD)°–\(s.maxTWD)°
- TWD trend: \(s.trendTWD > 0 ? "+" : "")\(String(format:"%.1f",s.trendTWD))° (+ = shifted right)
- Oscillation amplitude: ±\(String(format:"%.1f",s.oscAmplitude))°
- TWD sequence (30s): \(dirs)
- TWS avg: \(String(format:"%.1f",s.avgTWS)) KTS, range \(String(format:"%.1f",s.minTWS))–\(String(format:"%.1f",s.maxTWS)) KTS
- TWS trend: \(s.trendTWS > 0 ? "+" : "")\(String(format:"%.1f",s.trendTWS)) KTS (+ = building)

Give a concise tactical wind brief (max 130 words) for an upwind start. Cover:
1. Wind character (steady / oscillating / puffy — period and amplitude)
2. Shift trend (right / left / neutral) and what that means for tack choice
3. Speed trend (building / dropping / steady)
4. Concrete start recommendation (favoured tack, oscillation timing)
Use direct sailing language. No intro fluff.
"""
        let body: [String: Any] = [
            "model": "claude-opus-4-7",
            "max_tokens": 350,
            "messages": [["role": "user", "content": prompt]]
        ]

        var req = URLRequest(url: URL(string: "https://api.anthropic.com/v1/messages")!)
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.setValue(apiKey, forHTTPHeaderField: "x-api-key")
        req.setValue("2023-06-01", forHTTPHeaderField: "anthropic-version")
        req.httpBody = try JSONSerialization.data(withJSONObject: body)

        let (data, response) = try await URLSession.shared.data(for: req)
        if let http = response as? HTTPURLResponse, http.statusCode != 200 {
            throw APIError.httpError(http.statusCode)
        }
        let decoded = try JSONDecoder().decode(AnthropicResponse.self, from: data)
        if let err = decoded.error { throw APIError.api(err.message) }
        return decoded.content?.first?.text ?? "No response received."
    }

    // MARK: Helpers

    private static func circularMeanDeg(_ degrees: [Double]) -> Double {
        guard !degrees.isEmpty else { return 0 }
        let s = degrees.map { sin($0 * .pi / 180) }.reduce(0,+)
        let c = degrees.map { cos($0 * .pi / 180) }.reduce(0,+)
        let m = atan2(s, c) * 180 / .pi
        return m < 0 ? m + 360 : m
    }

    enum APIError: LocalizedError {
        case noKey, noData, httpError(Int), api(String)
        var errorDescription: String? {
            switch self {
            case .noKey:          return "No Anthropic API key set. Tap ⚙ to add one."
            case .noData:         return "No wind data collected yet."
            case .httpError(let c): return "API error \(c)."
            case .api(let m):     return "API: \(m)"
            }
        }
    }
}
