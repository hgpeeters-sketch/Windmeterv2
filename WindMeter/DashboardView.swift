import SwiftUI

struct DashboardView: View {
    @ObservedObject var bluetooth: BluetoothManager
    @StateObject private var tileStore = TileStore()
    @State private var editMode: EditMode = .inactive
    @State private var showAddSheet     = false
    @State private var showRacingSheet  = false
    @State private var unit: SpeedUnit  = .knots

    var body: some View {
        ZStack {
            Color.black.ignoresSafeArea()

            VStack(spacing: 0) {

                // ── Top bar ────────────────────────────────────────
                HStack(spacing: 14) {
                    Text("● UP10")
                        .font(.system(size: 11, weight: .medium, design: .monospaced))
                        .foregroundColor(.white.opacity(0.4))

                    Spacer()

                    // Unit toggle
                    Button { cycleUnit() } label: {
                        Text(unit.rawValue)
                            .font(.system(size: 11, weight: .bold, design: .monospaced))
                            .foregroundColor(.white.opacity(0.8))
                            .padding(.horizontal, 8)
                            .padding(.vertical, 4)
                            .overlay(RoundedRectangle(cornerRadius: 4)
                                .stroke(Color.white.opacity(0.28), lineWidth: 1))
                    }
                    .buttonStyle(.plain)

                    // Racing settings button
                    Button { showRacingSheet = true } label: {
                        Text("RACE")
                            .font(.system(size: 11, weight: .bold, design: .monospaced))
                            .foregroundColor(hasRacingData ? .white : .white.opacity(0.4))
                            .padding(.horizontal, 8)
                            .padding(.vertical, 4)
                            .overlay(RoundedRectangle(cornerRadius: 4)
                                .stroke(Color.white.opacity(hasRacingData ? 0.6 : 0.22), lineWidth: 1))
                    }
                    .buttonStyle(.plain)

                    // Edit toggle
                    Button {
                        withAnimation { editMode = editMode == .active ? .inactive : .active }
                    } label: {
                        Text(editMode == .active ? "DONE" : "EDIT")
                            .font(.system(size: 11, weight: .bold, design: .monospaced))
                            .foregroundColor(.white.opacity(editMode == .active ? 1 : 0.5))
                    }
                    .buttonStyle(.plain)
                }
                .padding(.horizontal, 16)
                .padding(.vertical, 10)

                Divider().background(Color.white.opacity(0.18))

                // ── Tile list ──────────────────────────────────────
                List {
                    ForEach(Array(tileStore.tiles.enumerated()), id: \.element.id) { idx, tile in
                        VStack(spacing: 0) {
                            InstrumentTileView(
                                config: tile,
                                data: bluetooth.windData,
                                maxSpeed: bluetooth.maxWindSpeed,
                                avgSpeed: bluetooth.avgWindSpeed,
                                unit: unit,
                                tileStore: tileStore,
                                large: idx == 0
                            )
                            Divider().background(Color.white.opacity(0.12))
                        }
                        .listRowInsets(EdgeInsets())
                        .listRowBackground(Color.black)
                        .listRowSeparator(.hidden)
                    }
                    .onMove(perform: tileStore.move)
                    .onDelete(perform: tileStore.delete)

                    // Add tile row (edit mode only)
                    if editMode == .active && !tileStore.addable.isEmpty {
                        Button { showAddSheet = true } label: {
                            HStack {
                                Image(systemName: "plus.circle")
                                    .font(.system(size: 14))
                                Text("ADD TILE")
                                    .font(.system(size: 12, weight: .bold, design: .monospaced))
                                    .tracking(2)
                            }
                            .foregroundColor(.white.opacity(0.4))
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 18)
                        }
                        .buttonStyle(.plain)
                        .listRowBackground(Color.black)
                        .listRowSeparator(.hidden)
                        .listRowInsets(EdgeInsets())
                    }
                }
                .listStyle(.plain)
                .scrollContentBackground(.hidden)
                .environment(\.editMode, $editMode)
            }
        }
        .preferredColorScheme(.dark)
        .sheet(isPresented: $showAddSheet) {
            AddTileView(tileStore: tileStore)
        }
        .sheet(isPresented: $showRacingSheet) {
            RacingSettingsView(tileStore: tileStore,
                               currentTWD: bluetooth.windData.windDirection)
        }
    }

    private var hasRacingData: Bool {
        tileStore.referenceTWD != nil || tileStore.markBearing != 0
    }

    private func cycleUnit() {
        let all = SpeedUnit.allCases
        withAnimation { unit = all[(all.firstIndex(of: unit)! + 1) % all.count] }
    }
}

// MARK: – Racing settings sheet

struct RacingSettingsView: View {
    @ObservedObject var tileStore: TileStore
    let currentTWD: Int
    @Environment(\.dismiss) var dismiss

    @State private var markText: String = ""
    @State private var tackText: String = ""

    var body: some View {
        ZStack {
            Color.black.ignoresSafeArea()

            VStack(spacing: 0) {
                HStack {
                    Text("RACE SETTINGS")
                        .font(.system(size: 13, weight: .bold, design: .monospaced))
                        .foregroundColor(.white)
                        .tracking(3)
                    Spacer()
                    Button("CLOSE") { dismiss() }
                        .font(.system(size: 11, design: .monospaced))
                        .foregroundColor(.white.opacity(0.45))
                }
                .padding(.horizontal, 18)
                .padding(.vertical, 14)

                Divider().background(Color.white.opacity(0.18))

                ScrollView {
                    VStack(spacing: 0) {

                        // ── Reference TWD ──────────────────────────
                        SettingsRow(title: "REFERENCE TWD",
                                    subtitle: "Lock current wind direction as reference for SHIFT tile") {
                            HStack(spacing: 12) {
                                if let ref = tileStore.referenceTWD {
                                    Text("\(ref)°")
                                        .font(.system(size: 28, weight: .bold, design: .monospaced))
                                        .foregroundColor(.white)
                                }
                                VStack(spacing: 6) {
                                    Button("SET NOW") {
                                        tileStore.referenceTWD = currentTWD
                                    }
                                    .font(.system(size: 11, weight: .bold, design: .monospaced))
                                    .foregroundColor(.white)
                                    .padding(.horizontal, 10)
                                    .padding(.vertical, 5)
                                    .overlay(RoundedRectangle(cornerRadius: 4)
                                        .stroke(Color.white.opacity(0.4), lineWidth: 1))

                                    if tileStore.referenceTWD != nil {
                                        Button("CLEAR") { tileStore.referenceTWD = nil }
                                            .font(.system(size: 10, design: .monospaced))
                                            .foregroundColor(.white.opacity(0.35))
                                    }
                                }
                            }
                        }

                        Divider().background(Color.white.opacity(0.12))

                        // ── Mark bearing ───────────────────────────
                        SettingsRow(title: "BEARING TO MARK",
                                    subtitle: "Course to windward mark — used to calculate lift / header") {
                            HStack(spacing: 12) {
                                TextField("000", text: $markText)
                                    .font(.system(size: 36, weight: .bold, design: .monospaced))
                                    .foregroundColor(.white)
                                    .keyboardType(.numberPad)
                                    .frame(width: 90)
                                    .multilineTextAlignment(.center)
                                    .onChange(of: markText) { v in
                                        if let n = Int(v), n >= 0, n <= 359 {
                                            tileStore.markBearing = n
                                        }
                                    }
                                Text("°")
                                    .font(.system(size: 24, weight: .bold, design: .monospaced))
                                    .foregroundColor(.white.opacity(0.5))
                            }
                        }

                        Divider().background(Color.white.opacity(0.12))

                        // ── Tack angle ────────────────────────────
                        SettingsRow(title: "TACK ANGLE",
                                    subtitle: "Degrees each side of true wind (default 45°)") {
                            HStack(spacing: 12) {
                                TextField("45", text: $tackText)
                                    .font(.system(size: 36, weight: .bold, design: .monospaced))
                                    .foregroundColor(.white)
                                    .keyboardType(.numberPad)
                                    .frame(width: 80)
                                    .multilineTextAlignment(.center)
                                    .onChange(of: tackText) { v in
                                        if let n = Int(v), n > 0, n < 90 {
                                            tileStore.tackAngle = n
                                        }
                                    }
                                Text("°")
                                    .font(.system(size: 24, weight: .bold, design: .monospaced))
                                    .foregroundColor(.white.opacity(0.5))
                            }
                        }

                        Divider().background(Color.white.opacity(0.12))

                        // ── Help text ─────────────────────────────
                        VStack(alignment: .leading, spacing: 8) {
                            Text("HOW IT WORKS")
                                .font(.system(size: 10, weight: .bold, design: .monospaced))
                                .foregroundColor(.white.opacity(0.3))
                                .tracking(2)
                            Text("SHIFT shows how many degrees the wind has moved right (+) or left (−) from your reference TWD.\n\nLIFT shows which tack is favoured based on the mark bearing. A positive number means you are lifted on that tack — the wind has swung toward you. Tack when you see the opposite tack showing a lift.")
                                .font(.system(size: 12, design: .monospaced))
                                .foregroundColor(.white.opacity(0.4))
                                .lineSpacing(4)
                        }
                        .padding(18)
                    }
                }
            }
        }
        .onAppear {
            markText = tileStore.markBearing == 0 ? "" : "\(tileStore.markBearing)"
            tackText = "\(tileStore.tackAngle)"
        }
        .presentationDetents([.large])
        .preferredColorScheme(.dark)
    }
}

private struct SettingsRow<Content: View>: View {
    let title: String
    let subtitle: String
    let content: () -> Content
    init(title: String, subtitle: String, @ViewBuilder content: @escaping () -> Content) {
        self.title = title; self.subtitle = subtitle; self.content = content
    }
    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(title)
                .font(.system(size: 11, weight: .bold, design: .monospaced))
                .foregroundColor(.white.opacity(0.5))
                .tracking(2)
            Text(subtitle)
                .font(.system(size: 11, design: .monospaced))
                .foregroundColor(.white.opacity(0.28))
            content()
                .padding(.top, 4)
        }
        .padding(18)
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}
