import SwiftUI

private let tabs = ["PRE-START", "RACE AREA", "RACING"]

struct ContentView: View {
    @StateObject private var bluetooth = BluetoothManager()
    @State private var page = 0

    var body: some View {
        ZStack {
            Color.black.ignoresSafeArea()

            if bluetooth.connectionState.isConnected {
                VStack(spacing: 0) {
                    TabView(selection: $page) {
                        PreStartView(bluetooth: bluetooth).tag(0)
                        RaceAreaView(bluetooth: bluetooth).tag(1)
                        DashboardView(bluetooth: bluetooth).tag(2)
                    }
                    .tabViewStyle(.page(indexDisplayMode: .never))

                    // Tab bar
                    Divider().background(Color.white.opacity(0.12))
                    HStack(spacing: 0) {
                        ForEach(tabs.indices, id: \.self) { i in
                            PageTab(label: tabs[i], index: i, selected: page)
                                .onTapGesture { withAnimation { page = i } }
                            if i < tabs.count - 1 {
                                Rectangle()
                                    .fill(Color.white.opacity(0.12))
                                    .frame(width: 1)
                            }
                        }
                    }
                    .frame(height: 36)
                }
                .transition(.opacity)
            } else {
                ScanningView(bluetooth: bluetooth).transition(.opacity)
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
                .font(.system(size: 9, weight: .bold, design: .monospaced))
                .tracking(1.5)
                .foregroundColor(selected == index ? .white : .white.opacity(0.28))
        }
        .frame(maxWidth: .infinity)
    }
}
