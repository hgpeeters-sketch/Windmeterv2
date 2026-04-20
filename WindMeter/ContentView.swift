import SwiftUI

struct ContentView: View {
    @StateObject private var bluetooth = BluetoothManager()

    var body: some View {
        ZStack {
            if bluetooth.connectionState.isConnected {
                DashboardView(bluetooth: bluetooth)
                    .transition(.opacity)
            } else {
                ScanningView(bluetooth: bluetooth)
                    .transition(.opacity)
            }
        }
        .animation(.easeInOut(duration: 0.4), value: bluetooth.connectionState.isConnected)
        .preferredColorScheme(.dark)
    }
}
