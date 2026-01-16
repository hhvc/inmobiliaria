import Cropper from "react-easy-crop";
import { useState } from "react";
import { cropImageToBlob } from "../../inmobiliaria/utils/cropImage";

const ImageCropModal = ({ src, aspect, onCancel, onConfirm }) => {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedPixels, setCroppedPixels] = useState(null);

  const onCropComplete = (_, pixels) => {
    setCroppedPixels(pixels);
  };

  const handleConfirm = async () => {
    const blob = await cropImageToBlob(src, croppedPixels);
    onConfirm(blob);
  };

  return (
    <div className="modal-backdrop fade show d-flex align-items-center justify-content-center">
      <div className="bg-white rounded shadow p-3" style={{ width: 400 }}>
        <div style={{ position: "relative", height: 300 }}>
          <Cropper
            image={src}
            crop={crop}
            zoom={zoom}
            aspect={aspect}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={onCropComplete}
          />
        </div>

        <div className="mt-3 d-flex justify-content-between">
          <button className="btn btn-outline-secondary" onClick={onCancel}>
            Cancelar
          </button>
          <button className="btn btn-primary" onClick={handleConfirm}>
            Aplicar recorte
          </button>
        </div>
      </div>
    </div>
  );
};

export default ImageCropModal;
