import os
import sys
import cv2

try:
    DATA_DIR = './data'
    if not os.path.exists(DATA_DIR):
        os.makedirs(DATA_DIR)

    number_of_classes = 36
    dataset_size = 100

    # Try to open the camera
    cap = cv2.VideoCapture(0)
    if not cap.isOpened():
        print("Error: Could not open camera.")
        sys.exit(1)

    for j in range(number_of_classes):
        if not os.path.exists(os.path.join(DATA_DIR, str(j))):
            os.makedirs(os.path.join(DATA_DIR, str(j)))

        print('Collecting data for class {}'.format(j))

        done = False
        while True:
            ret, frame = cap.read()
            if not ret:
                print("Error: Could not read frame.")
                sys.exit(1)
                
            cv2.putText(frame, 'Ready? Press "Q" ! :)', (100, 50), cv2.FONT_HERSHEY_SIMPLEX, 1.3, (0, 255, 0), 3,
                        cv2.LINE_AA)
            cv2.imshow('frame', frame)
            if cv2.waitKey(25) == ord('q'):
                cv2.destroyAllWindows()
                break

        counter = 0
        while counter < dataset_size:
            ret, frame = cap.read()
            if not ret:
                print("Error: Could not read frame.")
                sys.exit(1)
                
            cv2.imshow('frame', frame)
            cv2.waitKey(25)
            cv2.imwrite(os.path.join(DATA_DIR, str(j), '{}.jpg'.format(counter)), frame)
            counter += 1

    cap.release()
    cv2.destroyAllWindows()
    print("Data collection completed successfully.")
    
except Exception as e:
    print(f"Error during data collection: {e}")
    if 'cap' in locals() and cap is not None:
        cap.release()
    cv2.destroyAllWindows()
    sys.exit(1)
