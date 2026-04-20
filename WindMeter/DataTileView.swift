import SwiftUI

struct DataTileView: View {
    let label: String
    let value: String
    let icon: String
    var accent: Color = Color.cyan.opacity(0.7)

    var body: some View {
        VStack(spacing: 6) {
            Image(systemName: icon)
                .font(.system(size: 13, weight: .light))
                .foregroundColor(accent)

            Text(value)
                .font(.system(size: 17, weight: .bold, design: .monospaced))
                .foregroundColor(.white)
                .minimumScaleFactor(0.55)
                .lineLimit(1)

            Text(label)
                .font(.system(size: 9, weight: .semibold))
                .foregroundColor(.white.opacity(0.35))
                .tracking(1.5)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 14)
        .background(Color.white.opacity(0.04))
        .cornerRadius(14)
        .overlay(RoundedRectangle(cornerRadius: 14).stroke(Color.white.opacity(0.07), lineWidth: 1))
    }
}
