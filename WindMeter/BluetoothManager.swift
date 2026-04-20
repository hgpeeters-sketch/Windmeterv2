import CoreBluetooth
import Combine

final class BluetoothManager: NSObject, ObservableObject {

    // MARK: – BLE identifiers (Calypso UP10)
    private static let dataServiceUUID    = CBUUID(string: "180D")
    private static let dataCharUUID       = CBUUID(string: "2A39")
    private static let batteryServiceUUID = CBUUID(string: "180F")
    private static let batteryCharUUID    = CBUUID(string: "2A19")
    private static let envServiceUUID     = CBUUID(string: "181A")
    private static let envSpeedCharUUID   = CBUUID(string: "2A72")
    private static let envDirCharUUID     = CBUUID(string: "2A73")

    // MARK: – Published state
    @Published var windData = WindData()
    @Published var maxWindSpeed: Double = 0
    @Published var avgWindSpeed: Double = 0
    @Published var connectionState: ConnectionState = .disconnected
    @Published var discoveredPeripherals: [(CBPeripheral, String)] = []

    enum ConnectionState: Equatable {
        case disconnected, scanning, connecting, connected
        var label: String {
            switch self {
            case .disconnected: return "Disconnected"
            case .scanning:     return "Scanning…"
            case .connecting:   return "Connecting…"
            case .connected:    return "Connected"
            }
        }
        var isConnected: Bool { self == .connected }
    }

    // MARK: – Private
    private var central: CBCentralManager!
    private var peripheral: CBPeripheral?
    private var speedHistory: [Double] = []
    private let historyMax = 60

    override init() {
        super.init()
        central = CBCentralManager(delegate: self, queue: .main)
    }

    func startScanning() {
        guard central.state == .poweredOn else { return }
        discoveredPeripherals.removeAll()
        connectionState = .scanning
        central.scanForPeripherals(
            withServices: [Self.dataServiceUUID, Self.envServiceUUID],
            options: [CBCentralManagerScanOptionAllowDuplicatesKey: false]
        )
    }

    func connect(peripheral: CBPeripheral) {
        self.peripheral = peripheral
        connectionState = .connecting
        central.stopScan()
        central.connect(peripheral, options: nil)
    }

    func disconnect() {
        if let p = peripheral { central.cancelPeripheralConnection(p) }
    }

    private func resetStats() {
        maxWindSpeed = 0
        avgWindSpeed = 0
        speedHistory.removeAll()
    }

    private func updateStats(speed: Double) {
        if speed > maxWindSpeed { maxWindSpeed = speed }
        speedHistory.append(speed)
        if speedHistory.count > historyMax { speedHistory.removeFirst() }
        avgWindSpeed = speedHistory.reduce(0, +) / Double(speedHistory.count)
    }
}

// MARK: – CBCentralManagerDelegate
extension BluetoothManager: CBCentralManagerDelegate {
    func centralManagerDidUpdateState(_ central: CBCentralManager) {
        if central.state == .poweredOn { startScanning() }
    }

    func centralManager(_ central: CBCentralManager, didDiscover peripheral: CBPeripheral,
                        advertisementData: [String: Any], rssi RSSI: NSNumber) {
        let name = peripheral.name ?? advertisementData[CBAdvertisementDataLocalNameKey] as? String ?? "Unknown"
        if !discoveredPeripherals.contains(where: { $0.0.identifier == peripheral.identifier }) {
            discoveredPeripherals.append((peripheral, name))
        }
        let lc = name.lowercased()
        if lc.contains("calypso") || lc.contains("up10") || lc.contains("ultrasonic") {
            connect(peripheral: peripheral)
        }
    }

    func centralManager(_ central: CBCentralManager, didConnect peripheral: CBPeripheral) {
        connectionState = .connected
        resetStats()
        peripheral.delegate = self
        peripheral.discoverServices([Self.dataServiceUUID, Self.batteryServiceUUID, Self.envServiceUUID])
    }

    func centralManager(_ central: CBCentralManager, didFailToConnect peripheral: CBPeripheral, error: Error?) {
        connectionState = .disconnected
        self.peripheral = nil
        startScanning()
    }

    func centralManager(_ central: CBCentralManager, didDisconnectPeripheral peripheral: CBPeripheral, error: Error?) {
        connectionState = .disconnected
        self.peripheral = nil
        DispatchQueue.main.asyncAfter(deadline: .now() + 2) { self.startScanning() }
    }
}

// MARK: – CBPeripheralDelegate
extension BluetoothManager: CBPeripheralDelegate {
    func peripheral(_ peripheral: CBPeripheral, didDiscoverServices error: Error?) {
        peripheral.services?.forEach { peripheral.discoverCharacteristics(nil, for: $0) }
    }

    func peripheral(_ peripheral: CBPeripheral,
                    didDiscoverCharacteristicsFor service: CBService, error: Error?) {
        service.characteristics?.forEach { char in
            if char.properties.contains(.notify) { peripheral.setNotifyValue(true, for: char) }
            if char.properties.contains(.read)   { peripheral.readValue(for: char) }
        }
    }

    func peripheral(_ peripheral: CBPeripheral,
                    didUpdateValueFor characteristic: CBCharacteristic, error: Error?) {
        guard error == nil, let data = characteristic.value else { return }
        switch characteristic.uuid {
        case Self.dataCharUUID:
            if var r = WindData.from(data: data) {
                updateStats(speed: r.windSpeed)
                r.batteryLevel = max(windData.batteryLevel, r.batteryLevel)
                windData = r
            }
        case Self.batteryCharUUID:
            if let b = data.first { windData.batteryLevel = Int(b) }
        case Self.envSpeedCharUUID:
            if data.count >= 2 {
                let raw = UInt16(data[0]) | (UInt16(data[1]) << 8)
                windData.windSpeed = Double(raw) / 100.0
            }
        case Self.envDirCharUUID:
            if data.count >= 2 {
                let raw = UInt16(data[0]) | (UInt16(data[1]) << 8)
                windData.windDirection = Int(raw / 100) % 360
            }
        default: break
        }
    }
}
