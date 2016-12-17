class VideoQ {
  constructor(canvas) {
    this.size = 100;
    this.q = [];
    this.canvas = canvas;

    if (this.canvas == null) {
      return;
    }
    qCanvas.width = window.innerWidth * 0.9;
    qCanvas.height = 25;

    this.updateProgress();
  }
  updateProgress() {
    if (this.canvas == null) {
      return;
    }
    var canvasLength = 1800;
    var canvasHeight = 25;
    this.canvas.clearRect(0, 0, canvasLength, canvasHeight);
    this.canvas.fillStyle = "green";
    var progress = this.q.length / this.size;

    this.canvas.fillRect(0, 0, canvasLength * progress, canvasHeight);
    this.canvas.font="14px Georgia";
    this.canvas.fillStyle = "black";
    this.canvas.fillText((this.q.length).toFixed(0), canvasLength * progress / 2, 12);
  }
  add(v) {
    if (this.q.length <= this.size) {
      this.q.push(v);
    }
    this.updateProgress();
  }
  tryGet() {
    this.updateProgress();
    if (this.q.length > 0) {
      return this.q.shift();
    } else {
      return null;
    }
  }
}
