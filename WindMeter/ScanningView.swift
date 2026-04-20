import SwiftUI

struct ScanningView: View {
    @ObservedObject var bluetooth: BluetoothManager
    @State private var pulse = false
    @State private var showDeviceList = false

    var body: some View {
        ZStack {
            Color(red: 0.03, green: 0.04, blue: 0.08).ignoresSafeArea()

            VStack(spacing: 40) {
                Spacer()

                // Animated radar rings
                ZStack {
                    ForEach(0..<3) { i in
                        Circle()
                            .stroke(Color.cyan.opacity(pulse ? 0.0 : 0.4 - Double(i) * 0.1), lineWidth: 1.5)
                            .frame(width: CGFloat(80 + i * 60), height: CGFloat(80 + i * 60))
                            .scaleEffect(pulse ? 1.6 + Double(i) * 0.3 : 1)
                            .animation(
                                .easeOut(duration: 1.8).repeatForever(autoreverses: false)
                                    .delay(Double(i) * 0.5),
                                value: pulse
                            )
                    }
                    Image(systemName: "wind")
                        .font(.system(size: 36, weight: .light))
                        .foregroundColor(.cyan)
                }
                .frame(width: 200, height: 200)
                .onAppear { pulse = true }

                VStack(spacing: 12) {
                    Text("WindMeter")
                        .font(.system(size: 28, weight: .bold, design: .monospaced))
                        .foregroundColor(.white)

                    Text(bluetooth.connectionState.label)
                        .font(.system(size: 14, weight: .medium, design: .monospaced))
                        .foregroundColor(.cyan.opacity(0.8))
                }

                // Device list (if any found)
                if !bluetooth.discoveredPeripherals.isEmpty {
                    VStack(spacing: 8) {
                        Text("NEARBY DEVICES")
                            .font(.system(size: 11, weight: .semibold))
                            .foregroundColor(.white.opacity(0.4))
                            .tracking(2)

                        ForEach(bluetooth.discoveredPeripherals, id: \.0.identifier) { peripheral, name in
                            Button {
                                bluetooth.connect(peripheral: peripheral)
                            } label: {
                                HStack {
                                    Image(systemName: "antenna.radiowaves.left.and.right")
                                        .foregroundColor(.cyan)
                                    Text(name)
                                        .font(.system(size: 15, weight: .medium, design: .monospaced))
                                        .foregroundColor(.white)
                                    Spacer()
                                    Image(systemName: "chevron.right")
                                        .font(.system(size: 12))
                                        .foregroundColor(.white.opacity(0.3))
                                }
                                .padding(.horizontal, 16)
                                .padding(.vertical, 12)
                                .background(Color.white.opacity(0.06))
                                .cornerRadius(12)
                            }
                        }
                    }
                    .padding(.horizontal, 24)
                }

                Spacer()

                Text("Make sure your Calypso UP10\nis powered on and nearby")
                    .font(.system(size: 13))
                    .foregroundColor(.white.opacity(0.3))
                    .multilineTextAlignment(.center)
                    .padding(.bottom, 40)
            }
        }
    }
}
