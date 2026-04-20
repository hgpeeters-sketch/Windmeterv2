import SwiftUI

struct ContentView: View {
    @StateObject private var bluetooth = BluetoothManager()
    @State private var page = 0

    var body: some View {
        ZStack {
            Color.black.ignoresSafeArea()

            if bluetooth.connectionState.isConnected {
                VStack(spacing: 0) {
                    // Swipeable screens
                    TabView(selection: $page) {
                        PreStartView(bluetooth: bluetooth).tag(0)
                        DashboardView(bluetooth: bluetooth).tag(1)
                    }
                    .tabViewStyle(.page(indexDisplayMode: .never))

                    // Page indicator strip
                    Divider().background(Color.white.opacity(0.12))
                    HStack(spacing: 0) {
                        PageTab(label: "PRE-START", index: 0, selected: page)
                            .onTapGesture { withAnimation { page = 0 } }
                        Divider().background(Color.white.opacity(0.12)).frame(width: 1)
                        PageTab(label: "RACING",    index: 1, selected: page)
                            .onTapGesture { withAnimation { page = 1 } }
                    }
                    .frame(height: 36)
                }
                .transition(.opacity)
            } else {
                ScanningView(bluetooth: bluetooth)
                    .transition(.opacity)
            }
        }
        .animation(.easeInOut(duration: 0.35), value: bluetooth.connectionState.isConnected)
        .preferredColorScheme(.dark)
    }
}

private struct PageTab: View {
    let label: String
    let index: Int
    let selected: Int

    var body: some View {
        ZStack {
            Color.black
            Text(label)
                .font(.system(size: 10, weight: .bold, design: .monospaced))
                .tracking(2)
                .foregroundColor(selected == index ? .white : .white.opacity(0.3))
        }
        .frame(maxWidth: .infinity)
    }
}
