import AddApplianceToRoomModal from '@/src/components/AddApplianceToRoomModal';
import SelectApplianceTypeModal, { ModuleItem } from '@/src/components/SelectApplianceTypeModal';
import { useCallback, useMemo, useState } from 'react';

type RoomTarget = { id: string; roomName: string };

type UseAddApplianceFlowParams = {
  clinicId?: string | null;
  /**
   * Optional: if the screen already knows the room target (room detail screen),
   * you can pass it here so `open()` can be called with no args.
   */
  defaultRoom?: RoomTarget | null;
};

export function useAddApplianceFlow({ clinicId, defaultRoom = null }: UseAddApplianceFlowParams) {
  // Shared flow state (duplicated in both screens today)
  const [typeModalVisible, setTypeModalVisible] = useState(false);
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [selectedModule, setSelectedModule] = useState<ModuleItem | null>(null);

  // Only needed for screens that can open the flow for *different rooms*
  const [activeRoom, setActiveRoom] = useState<RoomTarget | null>(defaultRoom);

  /**
   * Open module picker for a room.
   * - In clinic/index, pass a room.
   * - In room detail, you can call open() with no args if defaultRoom was provided.
   */
  const open = useCallback(
    (room?: RoomTarget) => {
      const target = room ?? defaultRoom;
      if (!target) return;

      // avoid stale selection (you already do this in clinic/index)
      setSelectedModule(null);

      // set active room then open Select
      setActiveRoom(target);
      setAddModalVisible(false);
      setTypeModalVisible(true);
    },
    [defaultRoom]
  );

  const closeAll = useCallback(() => {
    setTypeModalVisible(false);
    setAddModalVisible(false);
    setSelectedModule(null);

    // reset room target back to default (or null)
    setActiveRoom(defaultRoom ?? null);
  }, [defaultRoom]);

  const backToSelect = useCallback(() => {
    setAddModalVisible(false);
    setTypeModalVisible(true);
  }, []);

  const onModulePicked = useCallback((m: ModuleItem) => {
    setSelectedModule(m);
    setTypeModalVisible(false);
    setAddModalVisible(true);
  }, []);

  /**
   * Convenience boolean: should we mount Add modal?
   * (Your screens currently mount Add modal only when roomId exists)
   */
  const canShowAdd = !!clinicId && !!activeRoom?.id;

  /**
   * The modals (render this once inside each screen).
   * Each screen still manages its own UI layout; this hook only manages flow + modal props.
   */
  const Modals = useMemo(() => {
    return (
      <>
        <SelectApplianceTypeModal
          visible={typeModalVisible}
          roomName={activeRoom?.roomName}
          closeOnSelect={false}
          onClose={() => setTypeModalVisible(false)}
          onSelect={onModulePicked}
        />

        {canShowAdd && (
          <AddApplianceToRoomModal
            visible={addModalVisible}
            clinicId={clinicId!}
            roomId={activeRoom!.id}
            roomName={activeRoom!.roomName}
            selectedModule={selectedModule}
            onBack={backToSelect}
            onCloseAll={closeAll}
          />
        )}
      </>
    );
  }, [
    typeModalVisible,
    addModalVisible,
    activeRoom,
    selectedModule,
    canShowAdd,
    clinicId,
    onModulePicked,
    backToSelect,
    closeAll,
  ]);

  return {
    /** Call this to start the flow */
    open,

    /** Optional: if you want manual control */
    closeAll,
    backToSelect,

    /** Expose state if screens need it */
    activeRoom,
    selectedModule,
    typeModalVisible,
    addModalVisible,

    /** Render this in the screen JSX */
    Modals,
  };
}
