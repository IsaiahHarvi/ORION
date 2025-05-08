#ifndef MERCATOR_H
#define MERCATOR_H

#define M_PI 3.14159265358979323846
#define DEG_TO_RAD (M_PI/180.)
#define RAD_TO_DEG (180./M_PI)
#define PI_OVER_2  ( M_PI / 2.0e0)
#define TWO_PI  (M_PI * 2.)
#define MAX_LAT    ( (M_PI * 89.5) / 180.0 )  /* 89.5 degrees in radians         */
#define NM_TO_RAD ( M_PI/(180.*60.) )
#define RAD_TO_NM ( (180.*60.)/M_PI )

/***************************************************************************/
/* RSC IDENTIFIER: MERCATOR
 *
 * ABSTRACT
 *
 *    This component provides conversions between Geodetic coordinates 
 *    (latitude and longitude in radians) and Mercator projection coordinates
 *    (easting and northing in meters).
 *
 * ERROR HANDLING
 *
 *    This component checks parameters for valid values.  If an invalid value
 *    is found, the error code is combined with the current error code using 
 *    the bitwise or.  This combining allows multiple error codes to be
 *    returned. The possible error codes are:
 *
 *          MERC_NO_ERROR           : No errors occurred in function
 *          MERC_LAT_ERROR          : Latitude outside of valid range
 *                                      (-89.5 to 89.5 degrees)
 *          MERC_LON_ERROR          : Longitude outside of valid range
 *                                      (-180 to 360 degrees)
 *          MERC_EASTING_ERROR      : Easting outside of valid range
 *                                      (False_Easting +/- ~20,500,000 m,
 *                                       depending on ellipsoid parameters
 *                                       and Origin_Latitude)
 *          MERC_NORTHING_ERROR     : Northing outside of valid range
 *                                      (False_Northing +/- ~23,500,000 m,
 *                                       depending on ellipsoid parameters
 *                                       and Origin_Latitude)
 *          MERC_ORIGIN_LAT_ERROR   : Origin latitude outside of valid range
 *                                      (-89.5 to 89.5 degrees)
 *          MERC_CENT_MER_ERROR     : Central meridian outside of valid range
 *                                      (-180 to 360 degrees)
 *          MERC_A_ERROR            : Semi-major axis less than or equal to zero
 *          MERC_B_ERROR            : Semi-minor axis less than or equal to zero
 *          MERC_A_LESS_B_ERROR     : Semi-major axis less than semi-minor axis
 *
 * REUSE NOTES
 *
 *    MERCATOR is intended for reuse by any application that performs a 
 *    Mercator projection or its inverse.
 *    
 * REFERENCES
 *
 *    Further information on MERCATOR can be found in the Reuse Manual.
 *
 *    MERCATOR originated from :  U.S. Army Topographic Engineering Center
 *                                Geospatial Information Division
 *                                7701 Telegraph Road
 *                                Alexandria, VA  22310-3864
 *
 * LICENSES
 *
 *    None apply to this component.
 *
 * RESTRICTIONS
 *
 *    MERCATOR has no restrictions.
 *
 * ENVIRONMENT
 *
 *    MERCATOR was tested and certified in the following environments:
 *
 *    1. Solaris 2.5 with GCC, version 2.8.1
 *    2. Windows 95 with MS Visual C++, version 6
 *
 * MODIFICATIONS
 *
 *    Date              Description
 *    ----              -----------
 *    10-02-97          Original Code
 *
 */


/***************************************************************************/
/*
 *                              DEFINES
 */
//#define PI         3.1415926535897932384626433832795  /* PI                            */
//#define PI_OVER_2  ( PI / 2.0e0)  
//#define MAX_LAT    ( (PI * 89.5) / 180.0 )  /* 89.5 degrees in radians         */

#define MERC_NO_ERROR           0x0000
#define MERC_LAT_ERROR          0x0001
#define MERC_LON_ERROR          0x0002
#define MERC_EASTING_ERROR      0x0004
#define MERC_NORTHING_ERROR     0x0008
#define MERC_ORIGIN_LAT_ERROR   0x0010
#define MERC_CENT_MER_ERROR     0x0020
#define MERC_A_ERROR            0x0040
#define MERC_B_ERROR            0x0080
#define MERC_A_LESS_B_ERROR     0x0100


/***************************************************************************/
/*
 *                              FUNCTION PROTOTYPES
 *                                for MERCATOR.C
 */

/* ensure proper linkage to c++ programs */
#ifdef __cplusplus
extern "C" {
#endif

  long Set_Mercator_Parameters(float a,      
                               float b,
                               float Origin_Latitude,
                               float Central_Meridian,
                               float False_Easting,
                               float False_Northing,
                               float *Scale_Factor);
/*
 * The function Set_Mercator_Parameters receives the ellipsoid parameters and
 * Mercator projcetion parameters as inputs, and sets the corresponding state 
 * variables.  It calculates and returns the scale factor.  If any errors
 * occur, the error code(s) are returned by the function, otherwise 
 * MERC_NO_ERROR is returned.
 *
 *    a                 : Semi-major axis of ellipsoid, in meters   (input)
 *    b                 : Semi-minor axis of ellipsoid, in meters   (input)
 *    Origin_Latitude   : Latitude in radians at which the          (input)
 *                          point scale factor is 1.0
 *    Central_Meridian  : Longitude in radians at the center of     (input)
 *                          the projection
 *    False_Easting     : A coordinate value in meters assigned to the
 *                          central meridian of the projection.     (input)
 *    False_Northing    : A coordinate value in meters assigned to the
 *                          origin latitude of the projection       (input)
 *    Scale_Factor      : Multiplier which reduces distances in the 
 *                          projection to the actual distance on the
 *                          ellipsoid                               (output)
 */


  void Get_Mercator_Parameters(float *a,
                               float *b,
                               float *Origin_Latitude,
                               float *Central_Meridian,
                               float *False_Easting,
                               float *False_Northing,
                               float *Scale_Factor);
/*
 * The function Get_Mercator_Parameters returns the current ellipsoid
 * parameters, Mercator projection parameters, and scale factor.
 *
 *    a                 : Semi-major axis of ellipsoid, in meters   (output)
 *    b                 : Semi-minor axis of ellipsoid, in meters   (output)
 *    Origin_Latitude   : Latitude in radians at which the          (output)
 *                          point scale factor is 1.0
 *    Central_Meridian  : Longitude in radians at the center of     (output)
 *                          the projection
 *    False_Easting     : A coordinate value in meters assigned to the
 *                          central meridian of the projection.     (output)
 *    False_Northing    : A coordinate value in meters assigned to the
 *                          origin latitude of the projection       (output)
 *    Scale_Factor      : Multiplier which reduces distances in the 
 *                          projection to the actual distance on the
 *                          ellipsoid                               (output)
 */


  long Convert_Geodetic_To_Mercator (float Latitude,
                                     float Longitude,
                                     float *Easting,
                                     float *Northing); 
/*
 * The function Convert_Geodetic_To_Mercator converts geodetic (latitude and
 * longitude) coordinates to Mercator projection easting, and northing
 * coordinates, according to the current ellipsoid and Mercator projection
 * parameters.  If any errors occur, the error code(s) are returned by the
 * function, otherwise MERC_NO_ERROR is returned.
 *
 *    Latitude          : Latitude (phi) in radians           (input)
 *    Longitude         : Longitude (lambda) in radians       (input)
 *    Easting           : Easting (X) in meters               (output)
 *    Northing          : Northing (Y) in meters              (output)
 */


  long Convert_Mercator_To_Geodetic(float Easting,
                                    float Northing,
                                    float *Latitude,
                                    float *Longitude);
/*
 * The function Convert_Mercator_To_Geodetic converts Mercator projection
 * easting and northing coordinates to geodetic (latitude and longitude)
 * coordinates, according to the current ellipsoid and Mercator projection
 * coordinates.  If any errors occur, the error code(s) are returned by the
 * function, otherwise MERC_NO_ERROR is returned.
 *
 *    Easting           : Easting (X) in meters                  (input)
 *    Northing          : Northing (Y) in meters                 (input)
 *    Latitude          : Latitude (phi) in radians              (output)
 *    Longitude         : Longitude (lambda) in radians          (output)
 */

#ifdef __cplusplus
}
#endif

#endif /* MERCATOR_H */

