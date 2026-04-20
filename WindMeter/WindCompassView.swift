import SwiftUI

// Full compass rose used on the scanning/direction panel
struct WindCompassView: View {
    let direction: Int
    let diameter: CGFloat

    var body: some View {
        WindRoseView(direction: direction, heading: 0)
            .frame(width: diameter, height: diameter)
    }
}

// Compact wind rose — used inside the dashboard box
struct WindRoseView: View {
    let direction: Int   // wind FROM direction
    let heading: Int     // boat heading (optional, 0 = ignored)

    private let cardinals = [("N",0.0),("E",90.0),("S",180.0),("W",270.0)]

    var body: some View {
        GeometryReader { geo in
            let size   = min(geo.size.width, geo.size.height)
            let cx     = geo.size.width  / 2
            let cy     = geo.size.height / 2
            let r      = size / 2 - 6

            ZStack {
                // Outer circle
                Circle()
                    .stroke(Color.white.opacity(0.25), lineWidth: 1)
                    .frame(width: r*2, height: r*2)

                // Tick marks
                ForEach(0..<72) { i in
                    let a   = Double(i) * 5.0
                    let maj = Int(a) % 45 == 0
                    TickMark(angle: a, outerR: r, length: maj ? 10 : 5)
                        .stroke(Color.white.opacity(maj ? 0.5 : 0.18), lineWidth: maj ? 1.5 : 0.8)
                }

                // Cardinal labels
                ForEach(cardinals, id: \.0) { lbl, angle in
                    let rad = (angle - 90) * .pi / 180
                    Text(lbl)
                        .font(.system(size: lbl == "N" ? 11 : 9,
                                      weight: .bold, design: .monospaced))
                        .foregroundColor(.white.opacity(lbl == "N" ? 0.9 : 0.45))
                        .offset(x: (r - 16) * cos(rad),
                                y: (r - 16) * sin(rad))
                }

                // Wind arrow
                WindArrow(direction: Double(direction), radius: r * 0.62)
                    .fill(Color.white)
                    .animation(.spring(response: 0.5, dampingFraction: 0.75), value: direction)

                // Centre dot
                Circle().fill(Color.black).frame(width: 8, height: 8)
                Circle().fill(Color.white).frame(width: 4, height: 4)
            }
            .position(x: cx, y: cy)
        }
    }

    private func cos(_ r: Double) -> CGFloat { CGFloat(Foundation.cos(r)) }
    private func sin(_ r: Double) -> CGFloat { CGFloat(Foundation.sin(r)) }
}

// MARK: – Shapes

private struct TickMark: Shape {
    let angle: Double
    let outerR: CGFloat
    let length: CGFloat

    func path(in rect: CGRect) -> Path {
        let cx = rect.midX, cy = rect.midY
        let rad = (angle - 90) * .pi / 180
        let x1 = cx + CGFloat(cos(rad)) * outerR
        let y1 = cy + CGFloat(sin(rad)) * outerR
        let x2 = cx + CGFloat(cos(rad)) * (outerR - length)
        let y2 = cy + CGFloat(sin(rad)) * (outerR - length)
        return Path { p in p.move(to: .init(x:x1,y:y1)); p.addLine(to: .init(x:x2,y:y2)) }
    }
}

private struct WindArrow: Shape {
    var direction: Double
    let radius: CGFloat
    var animatableData: Double { get { direction } set { direction = newValue } }

    func path(in rect: CGRect) -> Path {
        let cx = rect.midX, cy = rect.midY
        let rad    = (direction - 90) * .pi / 180
        let tipX   = cx + CGFloat(cos(rad))  * radius
        let tipY   = cy + CGFloat(sin(rad))  * radius
        let backX  = cx - CGFloat(cos(rad))  * (radius * 0.35)
        let backY  = cy - CGFloat(sin(rad))  * (radius * 0.35)
        let leftX  = cx + CGFloat(cos(rad + .pi*0.82)) * (radius * 0.28)
        let leftY  = cy + CGFloat(sin(rad + .pi*0.82)) * (radius * 0.28)
        let rightX = cx + CGFloat(cos(rad - .pi*0.82)) * (radius * 0.28)
        let rightY = cy + CGFloat(sin(rad - .pi*0.82)) * (radius * 0.28)
        return Path { p in
            p.move(to: .init(x: tipX, y: tipY))
            p.addLine(to: .init(x: rightX, y: rightY))
            p.addLine(to: .init(x: backX,  y: backY))
            p.addLine(to: .init(x: leftX,  y: leftY))
            p.closeSubpath()
        }
    }
}
