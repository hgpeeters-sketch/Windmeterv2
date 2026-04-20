import SwiftUI

struct WindCompassView: View {
    let direction: Int      // 0–359, where wind comes FROM
    let diameter: CGFloat

    private var radius: CGFloat { diameter / 2 }
    private let cardinals = [("N", 0.0), ("E", 90.0), ("S", 180.0), ("W", 270.0)]

    var body: some View {
        ZStack {
            // Outer border ring
            Circle()
                .stroke(Color.white.opacity(0.08), lineWidth: 1.5)
                .frame(width: diameter, height: diameter)

            // Tick marks: every 5°, major every 45°
            ForEach(0..<72) { i in
                let angle = Double(i) * 5.0
                let isMajor = Int(angle) % 45 == 0
                Rectangle()
                    .fill(Color.white.opacity(isMajor ? 0.45 : 0.14))
                    .frame(width: isMajor ? 2 : 1, height: isMajor ? 14 : 7)
                    .offset(y: -(radius - 1))
                    .rotationEffect(.degrees(angle))
            }

            // Direction highlight arc (±20° sector)
            DirectionArc(degrees: Double(direction), spread: 20, radius: radius - 18)
                .stroke(
                    LinearGradient(
                        colors: [Color.cyan.opacity(0.15), Color.cyan],
                        startPoint: .leading, endPoint: .trailing
                    ),
                    style: StrokeStyle(lineWidth: 5, lineCap: .round)
                )
                .frame(width: diameter - 36, height: diameter - 36)

            // Cardinal labels
            ForEach(cardinals, id: \.0) { label, angle in
                let rad = (angle - 90) * .pi / 180
                let r = radius - 30.0
                Text(label)
                    .font(.system(size: label == "N" ? 15 : 12, weight: label == "N" ? .bold : .medium,
                                  design: .monospaced))
                    .foregroundColor(label == "N" ? .cyan : .white.opacity(0.45))
                    .offset(x: r * cos(rad), y: r * sin(rad))
            }

            // Wind arrow pointing toward wind source
            ArrowShape()
                .fill(Color.cyan)
                .frame(width: 10, height: radius - 50)
                .offset(y: -(radius - 50) / 2)
                .rotationEffect(.degrees(Double(direction)))
                .shadow(color: Color.cyan.opacity(0.7), radius: 6)
                .animation(.spring(response: 0.5, dampingFraction: 0.7), value: direction)

            // Center hub
            Circle()
                .fill(Color(red: 0.03, green: 0.04, blue: 0.08))
                .frame(width: 12, height: 12)
            Circle()
                .fill(Color.cyan)
                .frame(width: 6, height: 6)
        }
        .frame(width: diameter, height: diameter)
    }
}

// MARK: – Shapes

private struct DirectionArc: Shape {
    var degrees: Double
    var spread: Double
    var radius: CGFloat

    var animatableData: Double {
        get { degrees }
        set { degrees = newValue }
    }

    func path(in rect: CGRect) -> Path {
        let center = CGPoint(x: rect.midX, y: rect.midY)
        let start = Angle.degrees(degrees - spread - 90)
        let end   = Angle.degrees(degrees + spread - 90)
        return Path { p in
            p.addArc(center: center, radius: radius, startAngle: start, endAngle: end, clockwise: false)
        }
    }
}

struct ArrowShape: Shape {
    func path(in rect: CGRect) -> Path {
        Path { p in
            let tip = CGPoint(x: rect.midX, y: rect.minY)
            let bl  = CGPoint(x: rect.midX - rect.width / 2, y: rect.maxY)
            let br  = CGPoint(x: rect.midX + rect.width / 2, y: rect.maxY)
            let notch = CGPoint(x: rect.midX, y: rect.maxY * 0.65)
            p.move(to: tip)
            p.addLine(to: br)
            p.addLine(to: notch)
            p.addLine(to: bl)
            p.closeSubpath()
        }
    }
}
