import SwiftUI

struct AddTileView: View {
    @ObservedObject var tileStore: TileStore
    @Environment(\.dismiss) var dismiss

    var body: some View {
        ZStack {
            Color.black.ignoresSafeArea()

            VStack(spacing: 0) {
                // Header
                HStack {
                    Text("ADD TILE")
                        .font(.system(size: 13, weight: .bold, design: .monospaced))
                        .foregroundColor(.white)
                        .tracking(3)
                    Spacer()
                    Button("CLOSE") { dismiss() }
                        .font(.system(size: 11, weight: .medium, design: .monospaced))
                        .foregroundColor(.white.opacity(0.45))
                }
                .padding(.horizontal, 18)
                .padding(.vertical, 14)

                Divider().background(Color.white.opacity(0.18))

                if tileStore.addable.isEmpty {
                    Spacer()
                    Text("ALL TILES ADDED")
                        .font(.system(size: 13, weight: .medium, design: .monospaced))
                        .foregroundColor(.white.opacity(0.3))
                        .tracking(2)
                    Spacer()
                } else {
                    List {
                        ForEach(tileStore.addable) { type in
                            Button {
                                tileStore.add(type)
                                if tileStore.addable.isEmpty { dismiss() }
                            } label: {
                                HStack(spacing: 16) {
                                    Text(type.rawValue)
                                        .font(.system(size: 18, weight: .bold, design: .monospaced))
                                        .foregroundColor(.white)
                                        .frame(width: 72, alignment: .leading)
                                    VStack(alignment: .leading, spacing: 3) {
                                        Text(type.fullName)
                                            .font(.system(size: 12, weight: .medium, design: .monospaced))
                                            .foregroundColor(.white.opacity(0.7))
                                        if type == .shift {
                                            Text("vs locked reference wind direction")
                                                .font(.system(size: 10, design: .monospaced))
                                                .foregroundColor(.white.opacity(0.35))
                                        }
                                        if type == .liftHeader {
                                            Text("based on mark bearing you set")
                                                .font(.system(size: 10, design: .monospaced))
                                                .foregroundColor(.white.opacity(0.35))
                                        }
                                    }
                                    Spacer()
                                    Image(systemName: "plus")
                                        .font(.system(size: 13))
                                        .foregroundColor(.white.opacity(0.35))
                                }
                                .padding(.vertical, 8)
                            }
                            .buttonStyle(.plain)
                            .listRowBackground(Color.black)
                            .listRowInsets(EdgeInsets(top: 0, leading: 18, bottom: 0, trailing: 18))
                        }
                    }
                    .listStyle(.plain)
                    .scrollContentBackground(.hidden)
                }
            }
        }
        .presentationDetents([.medium, .large])
        .preferredColorScheme(.dark)
    }
}
