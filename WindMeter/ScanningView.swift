import SwiftUI

struct ScanningView: View {
    @ObservedObject var bluetooth: BluetoothManager
    @State private var dotCount = 0

    let timer = Timer.publish(every: 0.5, on: .main, in: .common).autoconnect()

    var body: some View {
        ZStack {
            Color.black.ignoresSafeArea()

            VStack(spacing: 0) {

                // Top bar
                HStack {
                    Text("WINDMETER")
                        .font(.system(size: 13, weight: .bold, design: .monospaced))
                        .foregroundColor(.white)
                        .tracking(3)
                    Spacer()
                }
                .padding(.horizontal, 16)
                .padding(.vertical, 12)

                Divider().background(Color.white.opacity(0.2))

                Spacer()

                // Status box
                VStack(spacing: 24) {
                    // Animated compass ring
                    ZStack {
                        Circle()
                            .stroke(Color.white.opacity(0.15), lineWidth: 1)
                            .frame(width: 120, height: 120)
                        Circle()
                            .stroke(Color.white.opacity(0.35), lineWidth: 1)
                            .frame(width: 80, height: 80)

                        Image(systemName: "wind")
                            .font(.system(size: 32, weight: .thin))
                            .foregroundColor(.white)

                        // Rotating scan arc
                        ScanArc()
                            .stroke(Color.white, lineWidth: 2)
                            .frame(width: 120, height: 120)
                            .rotationEffect(.degrees(Double(dotCount) * 30))
                            .animation(.linear(duration: 0.5), value: dotCount)
                    }

                    VStack(spacing: 8) {
                        Text("SCANNING" + String(repeating: ".", count: dotCount % 4))
                            .font(.system(size: 14, weight: .semibold, design: .monospaced))
                            .foregroundColor(.white)
                            .tracking(2)
                            .frame(width: 160, alignment: .leading)

                        Text("Looking for Calypso UP10")
                            .font(.system(size: 12, weight: .regular, design: .monospaced))
                            .foregroundColor(.white.opacity(0.4))
                    }
                }

                Spacer()

                // Device list
                if !bluetooth.discoveredPeripherals.isEmpty {
                    Divider().background(Color.white.opacity(0.2))

                    VStack(spacing: 0) {
                        HStack {
                            Text("DEVICES FOUND")
                                .font(.system(size: 10, weight: .bold, design: .monospaced))
                                .foregroundColor(.white.opacity(0.4))
                                .tracking(2)
                            Spacer()
                        }
                        .padding(.horizontal, 16)
                        .padding(.vertical, 10)

                        ForEach(bluetooth.discoveredPeripherals, id: \.0.identifier) { peripheral, name in
                            Divider().background(Color.white.opacity(0.1))
                            Button {
                                bluetooth.connect(peripheral: peripheral)
                            } label: {
                                HStack {
                                    Text(name)
                                        .font(.system(size: 15, weight: .semibold, design: .monospaced))
                                        .foregroundColor(.white)
                                    Spacer()
                                    Text("CONNECT →")
                                        .font(.system(size: 11, weight: .bold, design: .monospaced))
                                        .foregroundColor(.white.opacity(0.5))
                                        .tracking(1)
                                }
                                .padding(.horizontal, 16)
                                .padding(.vertical, 14)
                            }
                            .buttonStyle(.plain)
                        }
                    }
                }
            }
        }
        .onReceive(timer) { _ in dotCount += 1 }
    }
}

private struct ScanArc: Shape {
    func path(in rect: CGRect) -> Path {
        Path { p in
            p.addArc(center: .init(x: rect.midX, y: rect.midY),
                     radius: rect.width / 2,
                     startAngle: .degrees(-90),
                     endAngle: .degrees(-40),
                     clockwise: false)
        }
    }
}
