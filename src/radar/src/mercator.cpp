
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
 *                               INCLUDES
 */

#include <math.h>
#include "mercator.h"



/*
 *    math.h     - Standard C math library
 *    mercator.h - Is for prototype error checking
 */


/***************************************************************************/
/*
 *                               DEFINES
 */



/***************************************************************************/
/*
 *                               GLOBALS
 */

/* Ellipsoid Parameters, default to WGS 84 */
static float Merc_a = 6378137.0;    /* Semi-major axis of ellipsoid in meters */
static float Merc_b = 6356752.3142;           /* Semi-minor axis of ellipsoid */
static float Merc_e = 0.08181919084262188000; /* Eccentricity of ellipsoid    */
static float Merc_es = 0.0066943799901413800; /* Eccentricity squared         */

/* Mercator projection Parameters */
static float Merc_Origin_Lat = 0.0;      /* Latitude of origin in radians     */
static float Merc_Origin_Long = 0.0;     /* Longitude of origin in radians    */
static float Merc_False_Northing = 0.0;  /* False northing in meters          */
static float Merc_False_Easting = 0.0;   /* False easting in meters           */
static float Merc_Scale_Factor = 1.0;    /* Scale factor                      */

/* Isometric to geodetic latitude parameters, default to WGS 84 */
static float Merc_ab = 0.00335655146887969400;
static float Merc_bb = 0.00000657187271079536;
static float Merc_cb = 0.00000001764564338702;
static float Merc_db = 0.00000000005328478445;

/* Maximum variance for easting and northing values for WGS 84.
 */
static float Merc_Delta_Easting = 20237883.0;
static float Merc_Delta_Northing = 23421740.0;
/*
 * These state variables are for optimization purposes.  The only function
 * that should modify them is Set_Mercator_Parameters.
 */


/***************************************************************************/
/*
 *                              FUNCTIONS     
 */


long Set_Mercator_Parameters(float a,      
                             float b,
                             float Origin_Latitude,
                             float Central_Meridian,
                             float False_Easting,
                             float False_Northing,
                             float *Scale_Factor)
{ /* BEGIN Set_Mercator_Parameters */
/*
 * The function Set_Mercator_Parameters receives the ellipsoid parameters and
 * Mercator projection parameters as inputs, and sets the corresponding state 
 * variables.  It caclulates and returns the scale factor.  If any errors
 * occur, the error code(s) are returned by the function, otherwise Merc_NO_ERROR
 * is returned.
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

  float a2;    /* Semi-major axis of ellipsoid to the second power         */
  float b2;    /* Semi-minor axis of ellipsoid to the second power         */
  float es2;   /* Eccentricity squared of ellipsoid to the second power    */
  float es3;   /* Eccentricity squared of ellipsoid to the third power     */
  float es4;   /* Eccentricity squared of ellipsoid to the fourth power    */
  float sin_olat; /* sin(Origin_Latitude), temp variable */
  int Error_Code = MERC_NO_ERROR;

  if (a <= 0.0)
  { /* Semi-major axis must be greater than zero */
    Error_Code |= MERC_A_ERROR;
  }
  if (b <= 0.0)
  { /* Semi-minor axis must be greater than zero */
    Error_Code |= MERC_B_ERROR;
  }
  if (a < b)
  { /* Semi-major axis can not be less than Semi-minor axis */
    Error_Code |= MERC_A_LESS_B_ERROR;
  }
  if ((Origin_Latitude < -MAX_LAT) || (Origin_Latitude > MAX_LAT))
  { /* origin latitude out of range */
    Error_Code |= MERC_ORIGIN_LAT_ERROR;
  }
  if ((Central_Meridian < -M_PI) || (Central_Meridian > (TWO_PI)))
  { /* origin longitude out of range */
    Error_Code |= MERC_CENT_MER_ERROR;
  }
  if (!Error_Code)
  { /* no errors */
    Merc_a = a;
    Merc_b = b;
    Merc_Origin_Lat = Origin_Latitude;
    if (Central_Meridian > M_PI)
      Central_Meridian -= (TWO_PI);
    Merc_Origin_Long = Central_Meridian;
    Merc_False_Northing = False_Northing;
    Merc_False_Easting = False_Easting;
    a2 = a * a;
    b2 = b * b;
    Merc_es = (a2 - b2) / a2;
    Merc_e = sqrt(Merc_es);
    sin_olat = sinf(Origin_Latitude);
    Merc_Scale_Factor = 1.0 / ( sqrt(1.e0 - Merc_es * sin_olat * sin_olat) 
                                / cosf(Origin_Latitude) );
    es2 = Merc_es * Merc_es;
    es3 = es2 * Merc_es;
    es4 = es3 * Merc_es;
    Merc_ab = Merc_es / 2.e0 + 5.e0 * es2 / 24.e0 + es3 / 12.e0
              + 13.e0 * es4 / 360.e0;
    Merc_bb = 7.e0 * es2 / 48.e0 + 29.e0 * es3 / 240.e0 
              + 811.e0 * es4 / 11520.e0;
    Merc_cb = 7.e0 * es3 / 120.e0 + 81.e0 * es4 / 1120.e0;
    Merc_db = 4279.e0 * es4 / 161280.e0;
    *Scale_Factor = Merc_Scale_Factor;
    Convert_Geodetic_To_Mercator( MAX_LAT, (Merc_Origin_Long + M_PI),                                           
                                  &Merc_Delta_Easting, &Merc_Delta_Northing);
    if (Merc_Delta_Easting < 0)
      Merc_Delta_Easting = -Merc_Delta_Easting;
    Merc_Delta_Easting *= 1.01;
    Merc_Delta_Easting -= Merc_False_Easting;
    Merc_Delta_Northing *= 1.01;
    Merc_Delta_Northing -= Merc_False_Northing;
  } /* END OF if(!Error_Code) */
  return (Error_Code);
} /* END OF Set_Mercator_Parameters */


void Get_Mercator_Parameters(float *a,
                             float *b,
                             float *Origin_Latitude,
                             float *Central_Meridian,
                             float *False_Easting,
                             float *False_Northing,
                             float *Scale_Factor)
{ /* BEGIN Get_Mercator_Parameters */
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

  *a = Merc_a;
  *b = Merc_b;
  *Origin_Latitude = Merc_Origin_Lat;
  *Central_Meridian = Merc_Origin_Long;
  *False_Easting = Merc_False_Easting;
  *False_Northing = Merc_False_Northing;
  *Scale_Factor = Merc_Scale_Factor;
  return;
} /* END OF Get_Mercator_Parameters */


long Convert_Geodetic_To_Mercator (float Latitude,
                                   float Longitude,
                                   float *Easting,
                                   float *Northing)
{ /* BEGIN Convert_Geodetic_To_Mercator */
/*
 * The function Convert_Geodetic_To_Mercator converts geodetic (latitude and
 * longitude) coordinates to Mercator projection (easting and northing)
 * coordinates, according to the current ellipsoid and Mercator projection
 * parameters.  If any errors occur, the error code(s) are returned by the
 * function, otherwise MERC_NO_ERROR is returned.
 *
 *    Latitude          : Latitude (phi) in radians           (input)
 *    Longitude         : Longitude (lambda) in radians       (input)
 *    Easting           : Easting (X) in meters               (output)
 *    Northing          : Northing (Y) in meters              (output)
 */

  float ctanz2;        /* Cotangent of z/2 - z - Isometric colatitude     */
  float e_x_sinlat;    /* e * sin(Latitude)                               */
  float Delta_Long;    /* Difference in origin longitude and longitude    */
  float tan_temp;
  float pow_temp;

  int Error_Code = MERC_NO_ERROR;

  if ((Latitude < -MAX_LAT) || (Latitude > MAX_LAT))
  { /* Latitude out of range */
    Error_Code |= MERC_LAT_ERROR;
  }
  if ((Longitude < -M_PI) || (Longitude > (TWO_PI)))
  { /* Longitude out of range */
    Error_Code |= MERC_LON_ERROR;
  }
  if (!Error_Code)
  { /* no errors */
    if (Longitude > M_PI)
      Longitude -= (TWO_PI);
    e_x_sinlat = Merc_e * sin(Latitude);
    tan_temp = tanf(M_PI / 4.e0 + Latitude / 2.e0);
    pow_temp = powf( ((1.e0 - e_x_sinlat) / (1.e0 + e_x_sinlat)),
                    (Merc_e / 2.e0) );
    ctanz2 = tan_temp * pow_temp;
    *Northing = Merc_Scale_Factor * Merc_a * logf(ctanz2) + Merc_False_Northing;
    Delta_Long = Longitude - Merc_Origin_Long;
    if (Delta_Long > M_PI)
      Delta_Long -= (TWO_PI);
    if (Delta_Long < -M_PI)
      Delta_Long += (TWO_PI);
    *Easting = Merc_Scale_Factor * Merc_a * Delta_Long
               + Merc_False_Easting;
  }
  return (Error_Code);
} /* END OF Convert_Geodetic_To_Mercator */


long Convert_Mercator_To_Geodetic(float Easting,
                                  float Northing,
                                  float *Latitude,
                                  float *Longitude)
{ /* BEGIN Convert_Mercator_To_Geodetic */
/*
 * The function Convert_Mercator_To_Geodetic converts Mercator projection
 * (easting and northing) coordinates to geodetic (latitude and longitude)
 * coordinates, according to the current ellipsoid and Mercator projection
 * coordinates.  If any errors occur, the error code(s) are returned by the
 * function, otherwise MERC_NO_ERROR is returned.
 *
 *    Easting           : Easting (X) in meters                  (input)
 *    Northing          : Northing (Y) in meters                 (input)
 *    Latitude          : Latitude (phi) in radians              (output)
 *    Longitude         : Longitude (lambda) in radians          (output)
 */

  float dx;     /* Delta easting - Difference in easting (easting-FE)      */
  float dy;     /* Delta northing - Difference in northing (northing-FN)   */
  float xphi;   /* Isometric latitude                                      */
  int Error_Code = MERC_NO_ERROR;

  if ((Easting < (Merc_False_Easting - Merc_Delta_Easting))
      || (Easting > (Merc_False_Easting + Merc_Delta_Easting)))
  { /* Easting out of range */
    Error_Code |= MERC_EASTING_ERROR;
  }
  if ((Northing < (Merc_False_Northing - Merc_Delta_Northing))
      || (Northing > (Merc_False_Northing + Merc_Delta_Northing)))
  { /* Northing out of range */
    Error_Code |= MERC_NORTHING_ERROR;
  }
  if (!Error_Code)
  { /* no errors */
    dy = Northing - Merc_False_Northing;
    dx = Easting - Merc_False_Easting;
    *Longitude = Merc_Origin_Long + dx / (Merc_Scale_Factor * Merc_a);
    xphi = PI_OVER_2
           - 2.e0 * atanf(1.e0 / exp(dy / (Merc_Scale_Factor * Merc_a)));
    *Latitude = xphi + Merc_ab * sinf(2.e0 * xphi) + Merc_bb * sinf(4.e0 * xphi)
                + Merc_cb * sinf(6.e0 * xphi) + Merc_db * sinf(8.e0 * xphi);
    if (*Longitude > M_PI)
      *Longitude -= (TWO_PI);
    if (*Longitude < -M_PI)
      *Longitude += (TWO_PI);
  }
  return (Error_Code);
} /* END OF Convert_Mercator_To_Geodetic */
