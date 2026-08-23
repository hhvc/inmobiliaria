import PropTypes from "prop-types";

import { normalizeInmuebleSharing } from "../utils/inmuebleAdminList.helpers";

const InmuebleSharingQuickEdit = ({
  inmueble,
  friendGroups,
  disabled,
  saving,
  onChange,
}) => {
  const sharing = normalizeInmuebleSharing(inmueble?.sharing || {});

  const updateNetwork = (checked) => {
    onChange({
      ...sharing,
      shareWithOnopropNetwork: checked,
      enabled: checked || sharing.friendGroupIds.length > 0,
      mode: checked ? "all_colleagues" : "friend_groups",
    });
  };

  const updateGroup = (groupId, checked) => {
    const friendGroupIds = checked
      ? [...sharing.friendGroupIds, groupId]
      : sharing.friendGroupIds.filter((id) => id !== groupId);

    onChange({
      ...sharing,
      friendGroupIds,
      enabled: sharing.shareWithOnopropNetwork || friendGroupIds.length > 0,
      mode: sharing.shareWithOnopropNetwork
        ? "all_colleagues"
        : "friend_groups",
    });
  };

  return (
    <div className="border rounded-3 p-3 bg-light-subtle mt-3">
      <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-2">
        <strong className="small">Compartición</strong>
        {saving && (
          <span className="small text-primary">
            <span className="spinner-border spinner-border-sm me-1" />
            Guardando…
          </span>
        )}
      </div>

      <div className="d-flex flex-wrap gap-3">
        <label className="form-check form-switch mb-0">
          <input
            className="form-check-input"
            type="checkbox"
            checked={sharing.shareWithOnopropNetwork}
            disabled={disabled || saving}
            onChange={(event) => updateNetwork(event.target.checked)}
          />
          <span className="form-check-label small">Red ONO Prop</span>
        </label>

        {friendGroups.map((group) => (
          <label className="form-check mb-0" key={group.id}>
            <input
              className="form-check-input"
              type="checkbox"
              checked={sharing.friendGroupIds.includes(group.id)}
              disabled={disabled || saving}
              onChange={(event) => updateGroup(group.id, event.target.checked)}
            />
            <span className="form-check-label small">{group.name}</span>
          </label>
        ))}
      </div>

      {!sharing.enabled && (
        <div className="small text-muted mt-2">No compartido.</div>
      )}

      {disabled && (
        <div className="small text-muted mt-2">
          Tu rol permite ver esta configuración, pero no modificarla.
        </div>
      )}
    </div>
  );
};

InmuebleSharingQuickEdit.propTypes = {
  inmueble: PropTypes.shape({
    sharing: PropTypes.shape({
      enabled: PropTypes.bool,
      mode: PropTypes.string,
      shareWithOnopropNetwork: PropTypes.bool,
      friendGroupIds: PropTypes.arrayOf(PropTypes.string),
    }),
  }).isRequired,
  friendGroups: PropTypes.arrayOf(PropTypes.shape({
    id: PropTypes.string.isRequired,
    name: PropTypes.string,
  })).isRequired,
  disabled: PropTypes.bool,
  saving: PropTypes.bool,
  onChange: PropTypes.func.isRequired,
};

InmuebleSharingQuickEdit.defaultProps = {
  disabled: false,
  saving: false,
};

export default InmuebleSharingQuickEdit;
